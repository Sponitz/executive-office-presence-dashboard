import { useAuth } from '@/context/AuthContext';
import { useEffect, useRef } from 'react';

export function Login() {
  const { login, isDemoMode } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Stars
    const stars: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random() * 0.8 + 0.2,
      });
    }

    // Floating particles (like dust/nebula)
    const particles: { x: number; y: number; size: number; speedX: number; speedY: number; color: string }[] = [];
    const colors = ['rgba(0, 85, 150, 0.3)', 'rgba(93, 194, 167, 0.3)', 'rgba(157, 29, 150, 0.2)', 'rgba(69, 151, 211, 0.3)'];
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 100 + 50,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Shooting stars
    const shootingStars: { x: number; y: number; length: number; speed: number; opacity: number; active: boolean }[] = [];
    
    const createShootingStar = () => {
      if (Math.random() < 0.02) {
        shootingStars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.5,
          length: Math.random() * 80 + 40,
          speed: Math.random() * 10 + 8,
          opacity: 1,
          active: true,
        });
      }
    };

    let animationId: number;
    const animate = () => {
      ctx.fillStyle = '#0a1628';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw gradient overlay
      const gradient = ctx.createRadialGradient(
        canvas.width * 0.3, canvas.height * 0.5, 0,
        canvas.width * 0.3, canvas.height * 0.5, canvas.width * 0.8
      );
      gradient.addColorStop(0, 'rgba(0, 85, 150, 0.15)');
      gradient.addColorStop(0.5, 'rgba(157, 29, 150, 0.08)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw floating particles
      particles.forEach(particle => {
        ctx.beginPath();
        const particleGradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size
        );
        particleGradient.addColorStop(0, particle.color);
        particleGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = particleGradient;
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < -particle.size) particle.x = canvas.width + particle.size;
        if (particle.x > canvas.width + particle.size) particle.x = -particle.size;
        if (particle.y < -particle.size) particle.y = canvas.height + particle.size;
        if (particle.y > canvas.height + particle.size) particle.y = -particle.size;
      });

      // Draw stars with twinkling effect
      stars.forEach(star => {
        const twinkle = Math.sin(Date.now() * 0.003 + star.x) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkle})`;
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
      });

      // Create and draw shooting stars
      createShootingStar();
      shootingStars.forEach((star, index) => {
        if (!star.active) return;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.lineWidth = 2;
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(star.x - star.length, star.y + star.length * 0.5);
        ctx.stroke();

        // Glow effect
        ctx.beginPath();
        ctx.strokeStyle = `rgba(69, 151, 211, ${star.opacity * 0.5})`;
        ctx.lineWidth = 4;
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(star.x - star.length * 0.5, star.y + star.length * 0.25);
        ctx.stroke();

        star.x += star.speed;
        star.y += star.speed * 0.5;
        star.opacity -= 0.02;

        if (star.opacity <= 0 || star.x > canvas.width || star.y > canvas.height) {
          shootingStars.splice(index, 1);
        }
      });

      // Draw a subtle planet/moon in the corner
      const planetX = canvas.width * 0.85;
      const planetY = canvas.height * 0.2;
      const planetRadius = Math.min(canvas.width, canvas.height) * 0.08;
      
      const planetGradient = ctx.createRadialGradient(
        planetX - planetRadius * 0.3, planetY - planetRadius * 0.3, 0,
        planetX, planetY, planetRadius
      );
      planetGradient.addColorStop(0, 'rgba(69, 151, 211, 0.4)');
      planetGradient.addColorStop(0.7, 'rgba(0, 85, 150, 0.3)');
      planetGradient.addColorStop(1, 'rgba(0, 85, 150, 0.1)');
      
      ctx.beginPath();
      ctx.fillStyle = planetGradient;
      ctx.arc(planetX, planetY, planetRadius, 0, Math.PI * 2);
      ctx.fill();

      // Planet ring
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(93, 194, 167, 0.3)';
      ctx.lineWidth = 3;
      ctx.ellipse(planetX, planetY, planetRadius * 1.5, planetRadius * 0.3, Math.PI * 0.1, 0, Math.PI * 2);
      ctx.stroke();

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#005596] to-[#4597D3] flex items-center justify-center shadow-lg shadow-[#005596]/30">
                  <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="absolute -inset-2 rounded-full bg-[#005596]/20 animate-pulse" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
              Improving Pulse
            </h1>
            <p className="text-slate-400 text-lg">
              Welcome back
            </p>
          </div>

          {/* Login Card */}
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-8 shadow-2xl">
            <button
              onClick={login}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-slate-900 rounded-xl font-semibold hover:bg-slate-100 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group"
            >
              <svg className="w-6 h-6 transition-transform group-hover:scale-110" viewBox="0 0 21 21" fill="none">
                <path d="M10 0H0V10H10V0Z" fill="#F25022" />
                <path d="M21 0H11V10H21V0Z" fill="#7FBA00" />
                <path d="M10 11H0V21H10V11Z" fill="#00A4EF" />
                <path d="M21 11H11V21H21V11Z" fill="#FFB900" />
              </svg>
              {isDemoMode ? 'Continue with Demo Mode' : 'Sign in with Microsoft'}
            </button>

            {isDemoMode && (
              <p className="text-center text-sm text-slate-400 mt-4">
                Demo mode is active
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              Powered by Improving
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
