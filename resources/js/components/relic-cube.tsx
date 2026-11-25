import { useEffect, useRef } from 'react';
import { RelicRenderer } from '@/components/relic-renderer';
import cubeLeft from '../../images/landing/cube-left.webp';
import cubeRight from '../../images/landing/cube-right.webp';
import relicStill from '../../images/landing/relic-still.webp';

/**
 * The molten cube in the landing relic, with its glow. It tumbles in WebGL;
 * under reduced motion it holds still, it pauses off screen, and where WebGL
 * is missing a still render of the same cube stands in. Styled by landing.css.
 */
export default function RelicCube() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const showStill = () => {
            canvas.style.backgroundImage = `url('${relicStill}')`;
        };

        let renderer: RelicRenderer;

        try {
            renderer = new RelicRenderer(canvas);
        } catch {
            showStill();

            return;
        }

        const still = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        let visible = true;
        let frameId = 0;
        let disposed = false;

        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
        });
        observer.observe(canvas);

        const frame = (milliseconds: number) => {
            if (visible) {
                renderer.draw(milliseconds);
            }

            frameId = requestAnimationFrame(frame);
        };

        renderer
            .loadTextures(cubeLeft, cubeRight)
            .then(() => {
                if (disposed) {
                    return;
                }

                if (still) {
                    renderer.draw(0);
                } else {
                    frameId = requestAnimationFrame(frame);
                }
            })
            .catch(showStill);

        return () => {
            disposed = true;
            cancelAnimationFrame(frameId);
            observer.disconnect();
            renderer.dispose();
        };
    }, []);

    return (
        <div className="ember">
            <div className="ember-halo" />
            <canvas ref={canvasRef} className="ember-cube" />
        </div>
    );
}
