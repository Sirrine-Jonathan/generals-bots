module.exports = class Objective {
  constructor(type, target, queue = null, started = false) {
    this.queue = queue;
    this.type = type;
    this.target = target;
    this.complete = false;
    this.started = started;
    this.initial_takeover_requirement;
  }

  peakNextMove = () => {
    return this.queue[0]
  }

  getNextMove = () => {
    return this.queue.shift();
  }

  initTakeoverRequirement = (num) => {
    this.initial_takeover_requirement = num;
  }

  setTakeoverRequirement = (num) => {
    this.take_over_requirement = num;
  }
}