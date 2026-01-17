/**
 * NeuralBackground - 3D Brain Constellation Canvas
 * Animated particle network that rotates and responds to mouse movement.
 * Creates a cyberpunk neural network effect behind the dashboard.
 */
import { useEffect, useRef } from 'react';
import './NeuralBackground.css';

const PARTICLE_COUNT = 400;
const MAX_CONNECTION_DIST = 80;
const ROTATION_SPEED = 0.001;

class Particle3D {
  constructor() {
    this.reset();
  }

  reset() {
    // Spherical coordinates for brain shape
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = Math.cbrt(Math.random());

    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    const xScale = 1;
    const yScale = 0.8;
    const zScale = 1.2;
    this.x = r * sinPhi * cosTheta * xScale;
    this.y = r * sinPhi * sinTheta * yScale;
    this.z = r * cosPhi * zScale;

    this.baseX = this.x;
    this.baseY = this.y;
    this.baseZ = this.z;
    this.size = Math.random() * 1.5 + 0.5;
    this.screenX = 0;
    this.screenY = 0;
    this.drawSize = 0;
  }

  update(angle, mouseX, mouseY, width, height) {
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const xRot = this.baseX * cosAngle - this.baseZ * sinAngle;
    const zRot = this.baseX * sinAngle + this.baseZ * cosAngle;

    const pX = (mouseX - width / 2) * 0.0002;
    const pY = (mouseY - height / 2) * 0.0002;

    this.x = xRot + pX;
    this.y = this.baseY + pY;
    this.z = zRot;
  }

  draw(ctx, centerX, centerY, scale) {
    const perspective = 400 / (400 - this.z * scale);
    this.screenX = centerX + this.x * scale * perspective;
    this.screenY = centerY + this.y * scale * perspective;
    this.drawSize = this.size * perspective;

    const alpha = Math.max(0, Math.min(1, perspective / 2.5));
    ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(this.screenX, this.screenY, this.drawSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

const NeuralBackground = () => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const angleRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Create particles
    particlesRef.current = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particlesRef.current.push(new Particle3D());
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const scale = Math.min(width, height) * 0.3;

      angleRef.current += ROTATION_SPEED;

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      // Update all particles first
      for (let i = 0; i < particles.length; i++) {
        particles[i].update(angleRef.current, mouse.x, mouse.y, width, height);
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.draw(ctx, centerX, centerY, scale);

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.screenX - p2.screenX;
          const dy = p1.screenY - p2.screenY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MAX_CONNECTION_DIST) {
            const alpha = (1 - dist / MAX_CONNECTION_DIST) * 0.3;
            ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
            ctx.lineWidth = 0.3 * p1.drawSize;
            ctx.beginPath();
            ctx.moveTo(p1.screenX, p1.screenY);
            ctx.lineTo(p2.screenX, p2.screenY);
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="neural-background" />;
};

export default NeuralBackground;
