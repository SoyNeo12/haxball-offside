# Haxball Offside Plugin
⚽ Haxball plugin that detects when a player is offside by obtaining their position and the position of the second-to-last defender. 

## Built with
[node-haxball](https://github.com/wxyz-abcd/node-haxball) library created by [@wxyz-abcd](https://github.com/wxyz-abcd)

## Installation & Usage
```bash
git clone https://github.com/SoyNeo12/haxball-offside.git
cd haxball-offside
npm install
```

1. Open `index.js` and set your token from: [TOKEN](https://haxball.com/headlesstoken)
2. Run the plugin:

```bash
node .
```

## Can it be improved?
Clearly, from the git clone onwards, the script is entirely yours.

## Details
- The ball will curve depending on the player's Y speed. After 1.4 seconds, it will be reset.
- It will also have a speed along the curve.
- 
