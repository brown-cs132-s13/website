"use strict";
var storageLocal = window.localStorage || {};

////////////////////////////////////////////////////////////////////////////////
// Setup
////////////////////////////////////////////////////////////////////////////////

var nav = document.getElementById('nav');
var header = document.getElementById('header');
var HEADER_HEIGHT = header.clientHeight;
var NAV_HEIGHT = nav.clientHeight;
var WORLD_WIDTH = 800;
var WORLD_HEIGHT = 400;
var PADDING = 50;

var c = document.createElement('canvas').getContext('2d');
c.canvas.width = WORLD_WIDTH + 2 * PADDING;
c.canvas.height = HEADER_HEIGHT + NAV_HEIGHT;
nav.firstChild.insertBefore(c.canvas, nav.firstChild.firstChild);

////////////////////////////////////////////////////////////////////////////////
// vec2
////////////////////////////////////////////////////////////////////////////////

function vec2(x, y) { return new Vec2(x, y); }
function Vec2(x, y) { this.x = x; this.y = y; }
Vec2.prototype = {
  plus: function(v) { return new Vec2(this.x + v.x, this.y + v.y); },
  minus: function(v) { return new Vec2(this.x - v.x, this.y - v.y); },
  times: function(n) { return new Vec2(this.x * n, this.y * n); },
  dividedBy: function(n) { return new Vec2(this.x / n, this.y / n); },
  length: function() { return Math.sqrt(this.x * this.x + this.y * this.y); },
  dot: function(v) { return this.x * v.x + this.y * v.y; },
  unit: function() { return this.dividedBy(this.length()); },
  equals: function(v) { return this.x == v.x && this.y == v.y; },
  clone: function() { return new Vec2(this.x, this.y); }
};

////////////////////////////////////////////////////////////////////////////////
// box
////////////////////////////////////////////////////////////////////////////////

function box(pos, size) { return new AABB(pos, size); }
function AABB(pos, size) { this.pos = pos; this.size = size; }
AABB.prototype = {
  overlaps: function(b) {
    return this.pos.x < b.pos.x + b.size.x && this.pos.x + this.size.x > b.pos.x &&
           this.pos.y < b.pos.y + b.size.y && this.pos.y + this.size.y > b.pos.y;
  },
  draw: function() {
    c.fillRect(this.pos.x, this.pos.y, this.size.x, this.size.y);
  },
  contains: function(p) {
    return p.x >= this.pos.x && p.x < this.pos.x + this.size.x
        && p.y >= this.pos.y && p.y < this.pos.y + this.size.y;
  },
  clone: function() {
    return new AABB(this.pos.clone(), this.size.clone());
  },
  center: function() {
    return this.size.dividedBy(2).plus(this.pos);
  }
};

////////////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////////////

// Move the box p along v.x then along v.y, but only move as
// far as we can without colliding with a solid rectangle
function move(p, v) {
  // Move rectangle along x axis
  for (var i = 0; i < world.boxes.length; i++) {
    var b = world.boxes[i];
    var c = box(vec2(p.pos.x + v.x * (v.x < 0), p.pos.y), vec2(p.size.x + Math.abs(v.x), p.size.y));
    if (c.overlaps(b)) {
      if (v.x < 0) v.x = b.pos.x + b.size.x - p.pos.x;
      else if (v.x > 0) v.x = b.pos.x - p.pos.x - p.size.x;
    }
  }
  p.pos.x += v.x;

  // Move rectangle along y axis
  for (var i = 0; i < world.boxes.length; i++) {
    var b = world.boxes[i];
    var c = box(vec2(p.pos.x, p.pos.y + v.y * (v.y < 0)), vec2(p.size.x, p.size.y + Math.abs(v.y)));
    if (c.overlaps(b)) {
      if (v.y < 0) v.y = b.pos.y + b.size.y - p.pos.y;
      else if (v.y > 0) v.y = b.pos.y - p.pos.y - p.size.y;
    }
  }
  p.pos.y += v.y;
}

function rgba(r, g, b, a) {
  return 'rgba(' + r.toFixed(0) + ', ' + g.toFixed(0) + ', ' + b.toFixed(0) + ', ' + a.toFixed(5) + ')';
}

function drawExit(point) {
  c.fillStyle = 'black';
  c.textAlign = 'center';
  c.font = '9px Arial';
  c.fillText('EXIT', point.x, point.y);
}

function drawKeys(fade) {
  var text = 'Use WASD to move';
  var p = world.player.box.center();
  c.font = 'lighter 12px HelveticaNeue-Light, "Helvetica Neue", Helvetica, Arial, sans-serif';
  c.fillStyle = rgba(0, 0, 0, 1 - fade);
  if (p.x + c.measureText(text).width > WORLD_WIDTH) {
    c.textAlign = 'right';
    p.x -= 20;
  } else {
    c.textAlign = 'left';
    p.x += 20;
  }
  c.fillText(text, p.x, p.y);
}

function drawRocket() {
  c.beginPath();
  c.moveTo(10, 0);
  c.quadraticCurveTo(0, 5, -10, 0);
  c.quadraticCurveTo(0, -5, 10, 0);
  c.fill();
  c.beginPath();
  c.moveTo(-10, 7);
  c.quadraticCurveTo(0, 0, -10, -7);
  c.quadraticCurveTo(-5, 0, -10, 7);
  c.fill();
}

////////////////////////////////////////////////////////////////////////////////
// Sprite
////////////////////////////////////////////////////////////////////////////////

function Sprite(name, x, y, drawFunc, children) {
  this.name = name;
  this.pos = vec2(x, y);
  this.angle = 0;
  this.children = children;
  this.drawFunc = drawFunc;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    this[child.name] = child;
  }
}

Sprite.prototype.draw = function() {
  c.save();
  c.translate(this.pos.x, this.pos.y);
  c.rotate(this.angle);
  this.drawFunc();
  for (var i = 0; i < this.children.length; i++) {
    this.children[i].draw();
  }
  c.restore();
};

////////////////////////////////////////////////////////////////////////////////
// Particles
////////////////////////////////////////////////////////////////////////////////

function BoomParticle(center, life) {
  this.center = center.clone();
  this.life = life;
}

BoomParticle.prototype = {
  draw: function() {
    var radius = 40;
    var innerRadius = Math.max(0, 1 - 2 * this.life) * radius;
    var outerRadius = Math.min(1, 2 - 2 * this.life) * radius;
    c.fillStyle = '#FB0';
    c.beginPath();
    c.arc(this.center.x, this.center.y, innerRadius, 0, Math.PI * 2, false);
    c.arc(this.center.x, this.center.y, outerRadius, Math.PI * 2, 0, true);
    c.fill();
  },

  update: function(seconds) {
    this.life -= seconds * 4;
    if (this.life < 0) {
      world.removeParticle(this);
    }
  }
};

////////////////////////////////////////////////////////////////////////////////
// Rocketeer
////////////////////////////////////////////////////////////////////////////////

function Rocketeer(center) {
  this.box = box(center.minus(vec2(10, 10)), vec2(20, 20));
  this.timeout = 0.5;
}

Rocketeer.prototype = {
  draw: function() {
    var p = this.box.center();
    var dir = world.player.box.center().minus(p);
    c.fillStyle = 'black';
    c.save();
    c.translate(p.x, p.y);
    c.rotate(Math.atan2(dir.y, dir.x));
    c.beginPath();
    c.arc(0, 0, 10, 0.3, Math.PI - 0.3, false);
    c.fill();
    c.beginPath();
    c.arc(0, 0, 10, Math.PI + 0.3, 2 * Math.PI - 0.3, false);
    c.fill();
    c.scale(1 - this.timeout, 1 - this.timeout);
    drawRocket();
    c.restore();
  },

  update: function(seconds) {
    this.timeout -= seconds;
    if (this.timeout < 0) {
      world.enemies.push(new Rocket(this.box.center()));
      this.timeout = 1;
    }
  },

  clone: function() {
    return new Rocketeer(this.box.center());
  }
};

function Rocket(center) {
  this.box = box(center.minus(vec2(5, 5)), vec2(10, 10));
  this.vel = world.player.box.center().minus(center).unit();
}

Rocket.prototype = {
  draw: function() {
    var p = this.box.center();
    c.fillStyle = 'black';
    c.save();
    c.translate(p.x, p.y);
    c.rotate(Math.atan2(this.vel.y, this.vel.x));
    drawRocket();
    c.restore();
  },

  update: function(seconds) {
    var dir = world.player.box.center().minus(this.box.center()).unit();
    this.vel = this.vel.plus(dir.times(300 * seconds));
    var delta = this.vel.times(seconds);
    move(this.box, delta);
    if (!this.vel.times(seconds).equals(delta)) {
      world.removeEnemy(this);
      world.particles.push(new BoomParticle(this.box.center(), 1));
    } else if (this.box.overlaps(world.player.box)) {
      gameStatus = STATUS.LOSE;
    }
  }
};

////////////////////////////////////////////////////////////////////////////////
// Objects
////////////////////////////////////////////////////////////////////////////////

var world = {
  enemies: [],
  particles: [],

  player: {
    box: box(vec2(WORLD_WIDTH - 10, -NAV_HEIGHT - 28), vec2(10, 28)),
    vel: vec2(0, 0),
    sprite: null,
    onFloor: false,
    facingRight: false,

    setup: function() {
      if (+storageLocal.playerX == storageLocal.playerX 
       && +storageLocal.playerY == storageLocal.playerY
       && storageLocal.playerY < 0) {
        this.box.pos.x = +storageLocal.playerX;
        this.box.pos.y = +storageLocal.playerY;
      }
      function lineTo(x, y) {
        return function() {
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(x, y);
          c.stroke();
        };
      }
      this.sprite = new Sprite('torso', 0, 0, lineTo(0, 10), [
        new Sprite('head', 0, 0, function() {
          c.beginPath();
          c.arc(0, -5, 3, 0, Math.PI * 2, false);
          c.fill();
        }, []),
        new Sprite('leftArm', 0, 0, lineTo(0, 5), [new Sprite('child', 0, 5, lineTo(0, 5), [])]),
        new Sprite('rightArm', 0, 0, lineTo(0, 5), [new Sprite('child', 0, 5, lineTo(0, 5), [])]),
        new Sprite('leftLeg', 0, 10, lineTo(0, 5), [new Sprite('child', 0, 5, lineTo(0, 5), [])]),
        new Sprite('rightLeg', 0, 10, lineTo(0, 5), [new Sprite('child', 0, 5, lineTo(0, 5), [])])
      ]);
    },

    draw: function() {
      c.strokeStyle = c.fillStyle = 'black';
      this.sprite.draw();
    },

    update: function(seconds) {
      // User input
      this.vel.x = (!!keys.D - !!keys.A) * 100;
      this.vel.y += seconds * 500;
      if (keys.W && this.onFloor) this.vel.y = -250;
      if (this.vel.x) this.facingRight = (this.vel.x > 0);

      // Collision with world
      this.onFloor = false;
      var delta = this.vel.times(seconds);
      move(this.box, delta);
      if (delta.y != this.vel.y * seconds) {
        if (this.vel.y > 0) this.onFloor = true;
        this.vel.y = 0;
      }

      // Animation
      var s = this.sprite;
      s.pos.x = this.box.pos.x + this.box.size.x / 2;
      s.pos.y = this.box.pos.y + 8;
      var sign = this.facingRight ? 1 : -1;
      if (!this.onFloor) {
        var frame = 1 / (1 + Math.exp(-delta.y / seconds / 40));
        // Jumping
        s.angle = (0.1 - 0.2 * frame) * sign;
        s.leftArm.angle = (-0.5 - 0.2 * frame) * sign;
        s.leftArm.child.angle = (-1.4 + 0.2 * frame) * sign;
        s.rightArm.angle = (0.6 + 0.6 * frame) * sign;
        s.rightArm.child.angle = -0.4 * sign;
        s.leftLeg.angle = (-1.7 + 0.6 * frame) * sign;
        s.leftLeg.child.angle = (2 - 0.6 * frame) * sign;
        s.rightLeg.angle = (0.3 - 0.4 * frame) * sign;
        s.rightLeg.child.angle = (0.3 + 0.1 * frame) * sign;
      } else if (delta.x == 0) {
        // Standing
        s.angle = 0;
        s.leftArm.angle = s.leftLeg.angle = 0.2;
        s.rightArm.angle = s.rightLeg.angle = -0.2;
        s.leftArm.child.angle = s.leftLeg.child.angle = 0;
        s.rightArm.child.angle = s.rightLeg.child.angle = 0;
      } else {
        // Running
        var frame = this.box.pos.x / 10 * sign;
        s.angle = 0.1 * sign;
        s.pos.y -= Math.abs(Math.cos(frame)) * 2;
        s.leftArm.angle = Math.cos(frame);
        s.rightArm.angle = -Math.cos(frame);
        s.leftArm.child.angle = -sign * 1.5;
        s.rightArm.child.angle = -sign * 1.5;
        s.leftLeg.angle = Math.cos(frame);
        s.rightLeg.angle = -Math.cos(frame);
        s.leftLeg.child.angle = Math.sin(frame) * 0.75 + 0.75 * sign;
        s.rightLeg.child.angle = -Math.sin(frame) * 0.75 + 0.75 * sign;
      }

      // Persistence
      localStorage.playerX = this.box.pos.x;
      localStorage.playerY = this.box.pos.y;
    }
  },

  boxes: [
    box(vec2(0, -999), vec2(0, 9999)),
    box(vec2(WORLD_WIDTH, -999), vec2(0, 9999)),
    box(vec2(-PADDING, 0), vec2(PADDING, 9999)),
    box(vec2(WORLD_WIDTH, 0), vec2(PADDING, 9999)),
    box(vec2(0, WORLD_HEIGHT), vec2(WORLD_WIDTH, 0))
  ],
  exit: null,

  loadLevel: function(level) {
    this.boxes = this.boxes.slice(0, 7).concat(level.boxes);
    this.exit = level.exit.clone();
    this.enemies = level.enemies.map(function(e) { return e.clone(); });
    this.particles = [];
  },

  draw: function() {
    // Draw particles
    for (var i = 0; i < this.particles.length; i++) {
      this.particles[i].draw();
    }

    // Draw static objects
    c.fillStyle = 'black';
    for (var i = 0; i < this.boxes.length; i++) {
      this.boxes[i].draw();
    }
    drawExit(this.exit);

    // Draw dynamic objects
    for (var i = 0; i < this.enemies.length; i++) {
      this.enemies[i].draw();
    }
    this.player.draw();
  },

  update: function(seconds) {
    this.player.update(seconds);
    if (gameStatus == STATUS.BEFORE) return;
    this.enemies.slice().map(function(e) {
      e.update(seconds);
    });
    this.particles.slice().map(function(p) {
      p.update(seconds);
    });
    if (box(this.exit.minus(vec2(5, 5)), vec2(10, 10)).overlaps(this.player.box)) {
      if (currentLevel + 1 < levels.length) {
        this.loadLevel(levels[++currentLevel]);
      } else {
        gameStatus = STATUS.WIN;
      }
    }
  },

  removeEnemy: function(e) { this.enemies.splice(this.enemies.indexOf(e), 1); },
  removeParticle: function(p) { this.particles.splice(this.particles.indexOf(p), 1); }
};

world.player.setup();

// Add boxes for the nav bar
var current = document.getElementById('current');
var left = current.offsetLeft - PADDING;
var right = left + current.clientWidth;
world.boxes.push(box(vec2(0, -NAV_HEIGHT), vec2(left, NAV_HEIGHT)));
world.boxes.push(box(vec2(right, -NAV_HEIGHT), vec2(c.canvas.width - right, NAV_HEIGHT)));

////////////////////////////////////////////////////////////////////////////////
// Levels
////////////////////////////////////////////////////////////////////////////////

var levels = [
  {
    boxes: [
      box(vec2(600, 340), vec2(20, 20)),
      box(vec2(640, 280), vec2(20, 20)),
      box(vec2(680, 220), vec2(20, 20)),
      box(vec2(720, 160), vec2(20, 20)),
      box(vec2(760, 100), vec2(20, 20))
    ],
    exit: vec2(770, 90),
    enemies: []
  },
  {
    boxes: [
      box(vec2(390, 200), vec2(20, 200)),
      box(vec2(430, 340), vec2(20, 20)),
      box(vec2(510, 280), vec2(20, 20)),
      box(vec2(430, 220), vec2(20, 20)),
      box(vec2(0, 200), vec2(20, 200)),
      box(vec2(20, 220), vec2(20, 180)),
      box(vec2(40, 240), vec2(20, 160)),
      box(vec2(60, 260), vec2(20, 140)),
      box(vec2(80, 280), vec2(20, 120)),
      box(vec2(100, 300), vec2(20, 100)),
      box(vec2(120, 320), vec2(20, 80)),
      box(vec2(140, 340), vec2(20, 60)),
      box(vec2(160, 360), vec2(20, 40)),
      box(vec2(180, 380), vec2(20, 20)),
      box(vec2(760, 100), vec2(20, 20))
    ],
    exit: vec2(10, 190),
    enemies: [
      new Rocketeer(vec2(400, 100))
    ]
  },
  {
    boxes: [
      box(vec2(0, 200), vec2(20, 20)),
      box(vec2(65, 160), vec2(20, 20)),
      box(vec2(130, 200), vec2(20, 20)),
      box(vec2(195, 240), vec2(20, 20)),
      box(vec2(260, 200), vec2(20, 20)),
      box(vec2(325, 160), vec2(20, 20)),
      box(vec2(390, 200), vec2(20, 20)),
      box(vec2(455, 240), vec2(20, 20)),
      box(vec2(520, 200), vec2(20, 20)),
      box(vec2(585, 160), vec2(20, 20)),
      box(vec2(650, 200), vec2(20, 20)),
      box(vec2(715, 240), vec2(20, 20)),
      box(vec2(780, 200), vec2(20, 20))
    ],
    exit: vec2(790, 190),
    enemies: [
      new Rocketeer(vec2(300, 380)),
      new Rocketeer(vec2(500, 380))
    ]
  },
  {
    boxes: [
      box(vec2(390, 340), vec2(20, 20)),
      box(vec2(390, 280), vec2(20, 20)),
      box(vec2(390, 220), vec2(20, 20)),
      box(vec2(390, 160), vec2(20, 20)),
      box(vec2(390, 100), vec2(20, 20))
    ],
    exit: vec2(400, 90),
    enemies: [
      new Rocketeer(vec2(20, 200))
    ]
  }
];
var currentLevel = 0;

world.loadLevel(levels[currentLevel]);

////////////////////////////////////////////////////////////////////////////////
// Game loop
////////////////////////////////////////////////////////////////////////////////

var STATUS = {
  BEFORE: 0,
  DURING: 1,
  WIN: 2,
  LOSE: 3
};

var prevTime = new Date().getTime();
var expanding = false;
var keysFade = 0;
var gameStatus = STATUS.BEFORE;
var loseTimeout = 0;

function expand() {
  function setWorldHeight(height) {
    nav.style.height = NAV_HEIGHT + height + 'px';
  }
  function animate() {
    var nextTime = new Date().getTime();
    t += (nextTime - prevTime) / 1000 * 2;
    prevTime = nextTime;
    if (t >= 1) {
      t = 1;
      clearInterval(interval);
      expanding = false;
    }
    setWorldHeight(Math.round(((6 * t - 15) * t + 10) * t * t * t * (WORLD_HEIGHT + 20)));
  }
  var t = 0;
  var prevTime = new Date().getTime();
  var interval = setInterval(animate, 1000 / 60);
  c.canvas.height = HEADER_HEIGHT + NAV_HEIGHT + WORLD_HEIGHT;
  nav.style.overflow = 'hidden';
  expanding = true;
}

function draw() {
  // Draw background
  c.clearRect(0, 0, c.canvas.width, c.canvas.height);

  // Enter world coordinates
  c.save();
  c.translate(PADDING, HEADER_HEIGHT + NAV_HEIGHT);

  switch (gameStatus) {
    case STATUS.BEFORE:
    case STATUS.DURING:
      c.fillStyle = 'white';
      c.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      world.draw();
      if (keysFade < 1) {
        drawKeys(keysFade);
      }
      break;
    case STATUS.WIN:
    case STATUS.LOSE:
      c.fillStyle = 'white';
      c.textAlign = 'center';
      c.font = 'bold 50px HelveticaNeue-CondensedBold, "Helvetica Neue", Helvetica, Arial, sans-serif';
      c.fillText((gameStatus == STATUS.WIN) ? 'WIN!' : 'FAIL', WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
      break;
  }

  // Leave world coordinates
  c.restore();
}

function update() {
  var nextTime = new Date().getTime();
  var seconds = (nextTime - prevTime) / 1000;
  prevTime = nextTime;

  if (gameStatus == STATUS.LOSE) {
    loseTimeout += seconds;
    if (loseTimeout > 1) {
      loseTimeout = 0;
      gameStatus = STATUS.DURING;
      world.loadLevel(levels[currentLevel]);
      world.player.box.pos = levels[currentLevel - 1].exit.minus(vec2(world.player.box.size.x / 2, world.player.box.size.y - 10));
      world.player.vel = vec2(0, 0);
      world.player.onFloor = false;
    }
  }

  if (!expanding && (gameStatus == STATUS.BEFORE || gameStatus == STATUS.DURING)) {
    world.update(seconds);
  }

  if (gameStatus == STATUS.BEFORE && world.player.box.pos.y + world.player.box.size.y > 0) {
    gameStatus = STATUS.DURING;
    expand();
  }

  if (keysFade > 0 || (keys.W | keys.A | keys.D)) {
    keysFade = Math.min(1, keysFade + seconds * 4);
  }
}

setInterval(function() { update(); draw(); }, 1000 / 60);

////////////////////////////////////////////////////////////////////////////////
// Keyboard
////////////////////////////////////////////////////////////////////////////////

var keys = {};

document.onkeydown = function(e) {
  keys[String.fromCharCode(e.which)] = true;
};

document.onkeyup = function(e) {
  keys[String.fromCharCode(e.which)] = false;
};
