// Paul Cusimano Homework 10 Improved
// Added particle trails
// made it so particles go off one side of the screen and come back on the other
// improved the explosion system to make it more visually appealing
// added sound effects for when particles collide, deeper sounds for larger particles


let particles = [];
const INITIAL_PARTICLES = 1000;
const INITIAL_RADIUS = 5;
const SPLIT_THRESHOLD = 60;
const SPLIT_PARTICLES = 50;
const SPLIT_COOLDOWN = 60; // how mant frames to wait before merging to prevent lag
const TRAIL_LENGTH = 20;
const TRAIL_OPACITY = 0.5;

const STAR_TYPES = [
  { minRadius: 2, color: [255, 80, 80] },    // red dwarf
  { minRadius: 8, color: [255, 160, 80] },   // orange dwarf
  { minRadius: 15, color: [255, 255, 180] }, // yellow star
  { minRadius: 30, color: [235, 245, 255] }, // white star
  { minRadius: 45, color: [150, 170, 255] }  // blue giant
];

let osc1, osc2, filter;
const MAX_SOUNDS = 3; // Limit simultaneous sounds
let soundQueue = [];

function setup() {
  createCanvas(600, 600);
  initializeParticles();
  
  // Initialize audio components
  osc1 = new p5.Oscillator('sine');
  osc2 = new p5.Oscillator('triangle');
  filter = new p5.LowPass();
  
  osc1.disconnect();
  osc2.disconnect();
  osc1.connect(filter);
  osc2.connect(filter);
  
  filter.freq(800);
  
  osc1.start();
  osc2.start();
  osc1.amp(0);
  osc2.amp(0);
}

// creates all the initial stars with ranom positions and velocities
function initializeParticles() {
  particles = [];
  for (let i = 0; i < INITIAL_PARTICLES; i++) {
    particles.push(new Particle(
      random(width),
      random(height),
      INITIAL_RADIUS,
      random(-2, 2),
      random(-2, 2)
    ));
  }
}

function draw() {
  background(0);
  
  // update and check collisions
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].edges();
    particles[i].display();
    
    // check collisions with other particles
    for (let j = particles.length - 1; j > i; j--) {
      particles[i].collide(particles[j], i, j);
    }
    
    // check if splitting
    if (particles[i].radius > SPLIT_THRESHOLD) {
      splitParticle(i);
    }
  }
}

class Particle {
  constructor(x, y, r, vx, vy) {
    this.position = createVector(x, y);
    this.velocity = createVector(vx, vy);
    this.radius = r;
    this.mass = PI * r * r; // mass is proportional to area
    this.splitCooldown = 0;
    this.trail = []; // Add trail array
  }

  update() {
    // Add current position to trail
    this.trail.push(createVector(this.position.x, this.position.y));
    
    // Remove old trail positions
    if (this.trail.length > TRAIL_LENGTH) {
      this.trail.shift();
    }
    
    this.position.add(this.velocity);
    if (this.splitCooldown > 0) {
      this.splitCooldown--;
    }
  }

  edges() {
    // Wrap horizontally
    this.position.x = (this.position.x + width) % width;
    
    // Wrap vertically 
    this.position.y = (this.position.y + height) % height;
  }

  collide(other, i, j) {
    let distance = this.position.dist(other.position);
    let minDist = this.radius + other.radius;
    
    // only collide none of particle is in cooldown
    if (distance < minDist && this.splitCooldown === 0 && other.splitCooldown === 0) {
      let absorber, absorbed;
      if (this.mass > other.mass || (this.mass === other.mass && random() < 0.5)) {
        absorber = this;
        absorbed = other;
        particles.splice(j, 1);
      } else {
        absorber = other;
        absorbed = this;
        particles.splice(i, 1);
      }
      
      //  give the mass and velocity to the bigger particle
      let totalMass = absorber.mass + absorbed.mass;
      let newVel = p5.Vector.add(
        p5.Vector.mult(absorber.velocity, absorber.mass),
        p5.Vector.mult(absorbed.velocity, absorbed.mass)
      ).div(totalMass);
      
      // update the big particle instead of making a new one 
      // cause its less jarring to see the particle teleport
      absorber.velocity = newVel;
      absorber.mass = totalMass;
      absorber.radius = sqrt(totalMass / PI);
      
      // Play merge sound
      playMergeSound(totalMass);
    }
  }

  getStarColor() {
    for (let i = STAR_TYPES.length - 1; i >= 0; i--) {
      if (this.radius >= STAR_TYPES[i].minRadius) {
        return STAR_TYPES[i].color;
      }
    }
    return STAR_TYPES[0].color;
  }

  display() {
    let col = this.getStarColor();
    noStroke();
    
    // Draw trail
    for (let i = 0; i < this.trail.length; i++) {
      let alpha = map(i, 0, this.trail.length, 0, 255 * TRAIL_OPACITY);
      fill(col[0], col[1], col[2], alpha);
      let trailRadius = map(i, 0, this.trail.length, this.radius * 0.5, this.radius * 2);
      ellipse(this.trail[i].x, this.trail[i].y, trailRadius);
    }
    
    // Draw main star
    fill(col[0], col[1], col[2]);
    ellipse(this.position.x, this.position.y, this.radius * 2);
  }
}

// create new smaller stars from bigger stars
// in a sort of 'explosion' effect
function splitParticle(index) {
  let parent = particles[index];
  let minMass = PI * INITIAL_RADIUS * INITIAL_RADIUS;
  let maxMass = PI * (INITIAL_RADIUS * 5) * (INITIAL_RADIUS * 5);
  let possibleParticles = floor(parent.mass / minMass);
  
  let remainingMass = parent.mass;
  let newParticles = [];
  
  // Create n-1 particles, leaving space for at least one more
  while (remainingMass > minMass * 2) {
    let randMass = random(minMass, min(maxMass, remainingMass * 0.5));
    remainingMass -= randMass;
    
    let radius = sqrt(randMass / PI);
    let angle = random(TWO_PI);
    let speed = map(radius, INITIAL_RADIUS, INITIAL_RADIUS * 5, 4, 1); // larger = slower
    
    let newParticle = new Particle(
      parent.position.x,
      parent.position.y,
      radius,
      parent.velocity.x + cos(angle) * speed,
      parent.velocity.y + sin(angle) * speed
    );
    
    newParticle.mass = randMass;
    newParticle.splitCooldown = SPLIT_COOLDOWN;
    newParticles.push(newParticle);
  }
  
  // Create final particle with remaining mass
  let finalRadius = sqrt(remainingMass / PI);
  let finalAngle = random(TWO_PI);
  let finalSpeed = map(finalRadius, INITIAL_RADIUS, INITIAL_RADIUS * 5, 4, 1);
  
  let finalParticle = new Particle(
    parent.position.x,
    parent.position.y,
    finalRadius,
    parent.velocity.x + cos(finalAngle) * finalSpeed,
    parent.velocity.y + sin(finalAngle) * finalSpeed
  );
  
  finalParticle.mass = remainingMass;
  finalParticle.splitCooldown = SPLIT_COOLDOWN;
  newParticles.push(finalParticle);
  
  particles.splice(index, 1);
  particles.push(...newParticles);
}

function playMergeSound(mass) {
  while (soundQueue.length > MAX_SOUNDS) {
    soundQueue.shift();
  }
  // Map mass to frequency
  let baseFreq = map(mass, 
    PI * INITIAL_RADIUS * INITIAL_RADIUS,
    PI * SPLIT_THRESHOLD * SPLIT_THRESHOLD, 
    400, 100);
  
  // Map mass to volume
  let amp = map(mass,
    PI * INITIAL_RADIUS * INITIAL_RADIUS,
    PI * SPLIT_THRESHOLD * SPLIT_THRESHOLD,
    0.05, 0.15);
    
  // 2 frequencies for a more interesting sound
  osc1.freq(baseFreq);
  osc2.freq(baseFreq * 1.5);
  
  //  fade in/out
  osc1.amp(amp, 0.05);
  osc2.amp(amp * 0.3, 0.05);
  
  // fade out
  setTimeout(() => {
    osc1.amp(0, 0.1);
    osc2.amp(0, 0.1);
  }, 100);
  
  soundQueue.push(Date.now());
}