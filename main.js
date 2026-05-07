{
    init: function(elevators, floors) {
        var elevator = elevators[0];
        var middleFloor = Math.floor(floors.length / 2);

        // sortQueueをinit内に定義
        function sortQueue(elevator) {
            var currentFloor = elevator.currentFloor();
            var direction = elevator.destinationDirection();
            var queue = elevator.destinationQueue;

            if(direction === "up") {
                var above = queue.filter(function(f) { return f >= currentFloor; }).sort(function(a, b) { return a - b; });
                var below = queue.filter(function(f) { return f < currentFloor; }).sort(function(a, b) { return b - a; });
                elevator.destinationQueue = above.concat(below);
            } else if(direction === "down") {
                var above = queue.filter(function(f) { return f <= currentFloor; }).sort(function(a, b) { return b - a; });
                var below = queue.filter(function(f) { return f > currentFloor; }).sort(function(a, b) { return a - b; });
                elevator.destinationQueue = above.concat(below);
            }
            elevator.checkDestinationQueue();
        }

        elevator.on("floor_button_pressed", function(floorNum) {
            elevator.goToFloor(floorNum);
            sortQueue(elevator);
        });

        elevator.on("idle", function() {
            elevator.goToFloor(middleFloor);
        });

        floors.forEach(function(floor) {
            floor.on("up_button_pressed", function() {
                if(elevator.loadFactor() < 0.7) {
                    elevator.goToFloor(floor.floorNum());
                    sortQueue(elevator);
                }
            });
            floor.on("down_button_pressed", function() {
                if(elevator.loadFactor() < 0.7) {
                    elevator.goToFloor(floor.floorNum());
                    sortQueue(elevator);
                }
            });
        });
    },

    update: function(dt, elevators, floors) {}
}