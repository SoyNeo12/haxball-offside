export default function (API) {
    const { Plugin, AllowFlags, Utils, CollisionFlags } = API;

    Object.setPrototypeOf(this, Plugin.prototype);
    Plugin.call(this, "offside", true, {
        version: "0.1",
        author: "neo",
        description: "Plugin for managing an offside room",
        allowFlags: AllowFlags.CreateRoom
    });

    let that = this,
        active = false,
        lastTouched = null,
        lastPassData = null,
        lastTouchTime = 0,
        originalInvMass = { player: null, ball: null };

    this.initialize = function () {
        active = false;
        lastTouched = null;
        lastPassData = null;
        lastTouchTime = 0;

        const invMass = that.room.stadium?.playerPhysics?.invMass;
        if (invMass && (!originalInvMass.ball && !originalInvMass.player)) {
            originalInvMass = { player: invMass, ball: 1.5 };
        }
    };

    function pointDistance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function detectTouch() {
        const players = that.room.players.filter(p => p.team !== 0 && p.disc);
        const ball = that.room.getBall();
        if (!ball || !players.length) return;

        const touching = players.find(p => pointDistance(p.disc.pos, ball.pos) <= p.disc.radius + ball.radius + 0.1);
        if (!touching) return null;

        if (touching && (!lastTouched || touching.id !== lastTouched.id)) {
            lastTouched = touching;
            return touching;
        }

        return null;
    }

    function setProperties(touching, defender) {
        that.room.pauseGame();
        const ball = that.room.getBall();
        if (!ball) return;

        const cf = CollisionFlags;
        const players = that.room.players.filter(p => p.team.id !== 0 && p.disc);
        Utils.runAfterGameTick(() => {
            for (const player of players) {
                that.room.setPlayerDiscProperties(player.id, {
                    invMass: 1000000
                });
            }

            that.room.setDiscProperties(0, {
                x: ball.pos.x,
                y: ball.pos.y,
                xspeed: 0,
                yspeed: 0,
                invMass: 0
            });

            that.room.setDiscProperties(5, {
                x: ball.pos.x,
                y: ball.pos.y,
                radius: 20
            });

            that.room.setDiscProperties(7, { x: touching.disc.pos.x, y: -600 });
            that.room.setDiscProperties(8, { x: touching.disc.pos.x, y: 600 });
            that.room.setDiscProperties(9, { x: defender.x, y: -600 });
            that.room.setDiscProperties(10, { x: defender.x, y: 600 });
        });

        setTimeout(() => {
            that.room.pauseGame();
            Utils.runAfterGameTick(() => {
                that.room.setDiscProperties(5, {
                    x: -2000,
                    y: -2000,
                    radius: 0.04
                });

                that.room.setDiscProperties(6, {
                    x: ball.pos.x,
                    y: ball.pos.y,
                    radius: 150,
                    cMask: lastTouched.team.id === 1 ? cf.red : cf.blue
                });

                that.room.setDiscProperties(0, { invMass: originalInvMass.ball });
                that.room.setDiscProperties(9, { x: 268, y: 710 });
                that.room.setDiscProperties(10, { x: 292, y: 709 });
            });
        }, 3000);
    }

    function resetGame() {
        const players = that.room.players.filter(p => p.team.id !== 0 && p.disc);
        Utils.runAfterGameTick(() => {
            that.room.setDiscProperties(6, {
                x: 2000,
                y: 2000,
                radius: 0.04,
                cMask: 0
            });

            that.room.setDiscProperties(0, { invMass: originalInvMass.ball });
            that.room.setDiscProperties(7, { x: 173, y: 715 });
            that.room.setDiscProperties(8, { x: 197, y: 715 });
            that.room.setDiscProperties(9, { x: 268, y: 710 });
            that.room.setDiscProperties(10, { x: 292, y: 709 });

            for (const player of players) {
                that.room.setPlayerDiscProperties(player.id, {
                    invMass: originalInvMass.player
                });
            }
        });
    }

    function getSecondLastDefender(attackingTeam) {
        const players = that.room.players.filter(p => p.team.id !== 0 && p.disc);
        if (players.length < 2) return null;

        const defendingTeam = attackingTeam === 1 ? 2 : 1;

        const defenders = players
            .filter(p =>
                p.team.id === defendingTeam &&
                ((defendingTeam === 1 && p.disc.pos.x < 0) || (defendingTeam === 2 && p.disc.pos.x > 0)) &&
                Math.abs(p.disc.pos.x) < 1200 &&
                Math.abs(p.disc.pos.y) < 600
            )
            .map(p => ({ player: p, x: p.disc.pos.x }));

        if (defenders.length < 2) return null;

        if (attackingTeam === 1) {
            defenders.sort((a, b) => b.x - a.x);
        } else {
            defenders.sort((a, b) => a.x - b.x);
        }

        return defenders[1];
    }

    function isOffsidePosition(player, defenderX, ballX, attackingTeam) {
        const x = player.disc.pos.x;
        if (attackingTeam === 1) {
            return x > 0 && x > ballX && x > defenderX;
        } else {
            return x < 0 && x < ballX && x < defenderX;
        }
    }

    function handleOffside(touching) {
        if (!lastPassData || active || !touching) return;

        const ball = that.room.getBall();
        if (!ball || ball.pos.x === 0) return;

        const defender = getSecondLastDefender(lastPassData.team);
        if (!defender) return;

        if (touching.team.id !== lastPassData.team) {
            lastPassData = null;
            return;
        }

        if (
            lastPassData.passerId !== touching.id &&
            lastPassData.offsidePlayers.includes(touching.id)
        ) {
            that.room.sendAnnouncement(`🚩 ${touching.name} committed an offside`, null, 0xFF5555, "bold", 2);
            setProperties(touching, defender);
            active = true;
            lastPassData = null;
        }
    }

    this.onPlayerBallKick = function (playerId) {
        const ball = that.room.getBall();
        const player = that.room.getPlayer(playerId);
        if (!ball || !player) return;

        if (!active) {
            const velX = ball.speed.x || 0;
            const deltaX = ball.pos.x - player.disc.pos.x;

            const isRedAttack = (player.team.id === 1) && (velX > 0 || (velX === 0 && deltaX > 0));
            const isBlueAttack = (player.team.id === 2) && (velX < 0 || (velX === 0 && deltaX < 0));

            if (!isRedAttack && !isBlueAttack) {
                lastPassData = null;
                return;
            }

            const attackingTeam = isRedAttack ? 1 : 2;

            const defender = getSecondLastDefender(attackingTeam);
            if (!defender) return;

            const attackers = that.room.players.filter(p => p.team.id === attackingTeam && p.disc);
            const offsidePlayers = attackers
                .filter(p => isOffsidePosition(p, defender.x, ball.pos.x, attackingTeam))
                .map(p => p.id);

            if (!lastPassData || lastPassData.passerId !== playerId) {
                lastPassData = {
                    team: attackingTeam,
                    offsidePlayers,
                    passerId: playerId,
                };
            }
        } else {
            const ygravity = player.disc.speed.y / 35 * -1;
            const newProperties = {
                xspeed: ball.speed.x * 1.6,
                yspeed: ball.speed.y * 1.6,
                ygravity
            };

            Utils.runAfterGameTick(() => {
                that.room.setDiscProperties(0, newProperties);
            });

            setTimeout(() => {
                Utils.runAfterGameTick(() => {
                    that.room.setDiscProperties(0, { ygravity: 0 });
                });
            }, 1400);

            active = false;
            lastPassData = null;
            resetGame();
        }
    };

    this.onPositionsReset = function () {
        resetGame();
        active = false;
        lastPassData = null;
        lastTouched = null;
        lastTouchTime = 0;
    };

    this.onGameTick = function () {
        const touching = detectTouch();
        if (touching) handleOffside(touching);
    };

    this.onGameStart = function () {
        resetGame();
        active = false;
        lastPassData = null;
        lastTouched = null;
        lastTouchTime = 0;
    };

    this.onCollisionDiscVsDisc = this.onCollisionDiscVsSegment = this.onCollisionDiscVsPlane = function (discId) {
        const ball = that.room.getBall();
        if (discId === 0 && ball && ball.gravity.y !== 0) {
            Utils.runAfterGameTick(() => {
                that.room.setDiscProperties(0, { ygravity: 0 });
            });
        }
    };
}
