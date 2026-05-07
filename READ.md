# Elevator Saga 実装レポート

## 1. 問題の理解とアプローチ

### 問題の捉え方
エレベーターで乗客を効率よく輸送するスケジューリング問題として捉えた。
制約時間内に一定数の乗客を運ぶためには、以下の2点が重要だと考えた。

- **無駄な移動を減らす**：不要なフロアへの立ち寄りや上下の往復を防ぐ
- **乗降のタイミングを最適化する**：満員時の空振り停車を防ぎ、乗客を効率よく乗降させる

### 設計戦略
シンプルなイベント駆動から始め、問題が発生するたびに段階的に改善する方針をとった。
複雑なアルゴリズムを最初から実装するより、動作を観察しながらボトルネックを特定して改善する方が確実だと判断した。

### 最適化の方針と考慮した仕様
- `loadFactor()`による満員チェック（空振り停車の防止）
- `passing_floor`イベントによる通過フロアでの臨機応変な停車
- `destinationQueue`の並び替えによる移動方向の一貫性確保
- idle時の待機位置（中央階待機でレスポンスを向上）

---

## 2. 実装の流れと改善内容

### Step 1：シンプルなイベント駆動実装
**方針**
- フロアボタンが押されたらそのフロアへ向かう
- 乗客が内部でボタンを押したらそのフロアへ向かう
- idle時は0階で待機

**結果**
チャレンジ1（3フロア・1台・15人・60秒）はクリア。

---

### Step 2：満員チェックの追加
**問題**
満員のエレベーターがフロアボタンに反応して空振り停車を繰り返す可能性に気づいた。

**改善**
`loadFactor() < 0.7`のガードをフロアボタンのイベントに追加し、満員に近い場合はフロア呼び出しを無視するようにした。

---

### Step 3：idle時の待機階を中央階に変更
**問題**
チャレンジ3（5フロア・1台・23人・60秒）でタイムアウト。0階待機だと上階からの呼び出しへの反応が遅い。

**改善**
`Math.floor(floors.length / 2)`で動的に中央階を計算し、idle時の待機位置を中央階に変更。
どのフロアからの呼び出しに対しても最大移動距離が半減した。

---

### Step 4：通過フロアへの優先停車
**問題**
乗客が降りたいフロアを通過してしまうケースがあった。

**改善**
`passing_floor`イベントで`getPressedFloors()`を確認し、降車フロアを通過しそうな場合は`goToFloor(floorNum, true)`で優先停車するようにした。
ただし進行方向と逆のフロアへの停車は上下運動を増やすため、進行方向チェックを追加した。

```javascript
elevator.on("passing_floor", function(floorNum, direction) {
    var pressedFloors = elevator.getPressedFloors();
    if(pressedFloors.indexOf(floorNum) !== -1) {
        var currentFloor = elevator.currentFloor();
        var isOnTheWay = (direction === "up" && floorNum > currentFloor) ||
                         (direction === "down" && floorNum < currentFloor);
        if(isOnTheWay) {
            elevator.goToFloor(floorNum, true);
        }
    }
});
```

---

### Step 5：idle時の不要な中央階移動を防止
**問題**
idle発火直後に乗客がボタンを押すと、キューが`[中央階, 目的地]`の順になり中央階への無駄な移動が発生していた。

**改善**
`floor_button_pressed`で`goToFloor(floorNum, true)`を使い、idle時の中央階移動より乗客の目的地を優先するようにした。

---

### Step 6：destinationQueueのソートによるスキャンアルゴリズム
**問題**
フロアボタンが押されるたびに即座にキューに積むと、`[3階, 1階, 4階, 2階]`のようなバラバラな順番になり小刻みな上下運動が発生していた。

**改善**
フロアをキューに追加するたびに、進行方向を考慮してキューを並び替えるようにした。

- 上昇中：現在地より上のフロアを昇順で先に処理し、下のフロアは後回し
- 下降中：現在地より下のフロアを降順で先に処理し、上のフロアは後回し

これにより一方向に移動しながら順番にフロアを拾えるようになった（スキャンアルゴリズム）。

```javascript
function sortQueue(elevator) {
    var currentFloor = elevator.currentFloor();
    var direction = elevator.destinationDirection();
    var queue = elevator.destinationQueue;

    if(direction === "up") {
        var above = queue.filter(function(f) { return f >= currentFloor; })
                         .sort(function(a, b) { return a - b; });
        var below = queue.filter(function(f) { return f < currentFloor; })
                         .sort(function(a, b) { return b - a; });
        elevator.destinationQueue = above.concat(below);
    } else if(direction === "down") {
        var above = queue.filter(function(f) { return f <= currentFloor; })
                         .sort(function(a, b) { return b - a; });
        var below = queue.filter(function(f) { return f > currentFloor; })
                         .sort(function(a, b) { return a - b; });
        elevator.destinationQueue = above.concat(below);
    }
    elevator.checkDestinationQueue();
}
```

**成功した工夫**
- キュー追加のたびにソートすることで、毎フレームのソートによる方向の乱れを防いだ
- 進行方向側のフロアを優先することで、不要なUターンをなくした

**失敗した工夫**
- `update`関数で毎フレームソートする方法は、方向が定まらず上下運動がかえって増えた

---

### 提出コードの達成状況
- チャレンジ1（15人・60秒）：クリア ✅
- チャレンジ2：クリア ✅
- チャレンジ3（23人・60秒）：クリア ✅

---

## 3. LLMの活用

### 使用ツール
Claude（claude.ai）

### 実際に使用したプロンプトと改善の流れ
https://claude.ai/share/2b08c1a7-8e92-4969-a1b3-b36027e0bfef


### 出力結果の評価と活用
Claudeはコードの生成だけでなく、問題の原因分析にも活用した。特に「なぜ空振りが起きるのか」「なぜ上下運動が増えるのか」といった原因の説明が参考になり、単にコードを貼り付けるのではなく理解した上で採用・不採用を判断できた。

一方でLLMが提案したコードをそのまま採用せず、動作を観察して自分でフィードバックを返すサイクルを繰り返したことが最終的な品質向上につながったと感じている。

---

## 4. 今後の改善案

- **複数エレベーターへの対応**：エレベーターを役割分担させる（上層階担当・下層階担当など）
- **goingUpIndicator / goingDownIndicatorの活用**：方向インジケーターを正確に制御し、乗客が意図した方向のエレベーターにのみ乗るようにする