/*
 * The relic on the landing page: a rounded molten cube ray-marched in a
 * fragment shader. A rounded box cannot be built from flat CSS faces without
 * gaps at its corners, and Safari flickers on CSS 3D inside masked layers, so
 * the cube is drawn into a single flat canvas instead.
 */

const VERTEX_SHADER = `
attribute vec2 corner;
varying vec2 uv;

void main() {
    uv = corner;
    gl_Position = vec4(corner, 0.0, 1.0);
}`;

/*
 * Axes are the CSS ones (x right, y down, z towards the viewer), in units of
 * the cube edge. The canvas spans 1.8 edges, the eye sits 7 edges away like
 * the CSS perspective did. The rough, slightly soft outline is drawn here at
 * full display resolution: Safari rasterises SVG filters on HTML at 1x, which
 * blurred the cube on retina screens.
 */
const FRAGMENT_SHADER = `
precision highp float;

varying vec2 uv;
uniform mat3 toScreen;
uniform mat3 toLocal;
uniform sampler2D textureA;
uniform sampler2D textureB;
uniform vec3 light;
uniform float pixel;

const float HALF = 0.485;
const float ROUND = 0.12;
const float EYE = 7.0;

float roundedBox(vec3 p) {
    vec3 q = abs(p) - (HALF - ROUND);
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - ROUND;
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

// A still, two-octave wobble of the screen position, so the outline reads as
// hand-made rather than geometric.
vec2 rough(vec2 p) {
    vec2 q = p * 2.75;
    vec2 wobble = vec2(
        noise(q) + 0.5 * noise(q * 2.0 + 17.0),
        noise(q + 31.0) + 0.5 * noise(q * 2.0 + 53.0)
    );

    return (wobble / 1.5 - 0.5) * 0.064;
}

vec3 lava(vec3 p, vec3 n) {
    vec3 w = pow(abs(n), vec3(6.0));
    w /= w.x + w.y + w.z;
    vec2 onX = p.zy / (2.0 * HALF) + 0.5;
    vec2 onY = p.xz / (2.0 * HALF) + 0.5;
    vec2 onZ = p.xy / (2.0 * HALF) + 0.5;

    return texture2D(textureB, onX).rgb * w.x
        + texture2D(textureA, onY).rgb * w.y
        + texture2D(textureA, onZ).rgb * w.z;
}

void main() {
    vec3 eye = vec3(0.0, 0.0, EYE);
    vec2 at = uv + rough(uv);
    vec3 dir = normalize(vec3(at.x * 0.9, -at.y * 0.9, 0.0) - eye);
    vec3 origin = toLocal * eye;
    vec3 ray = toLocal * dir;

    float travelled = EYE - 1.0;
    float gap = 1.0;
    float nearest = 1.0;
    float nearestAt = travelled;

    for (int i = 0; i < 80; i++) {
        gap = roundedBox(origin + ray * travelled);

        if (gap < nearest) {
            nearest = gap;
            nearestAt = travelled;
        }

        if (gap < 0.0005 || travelled > EYE + 1.0) {
            break;
        }

        travelled += gap;
    }

    // Rays that pass just outside the cube still pick up its colour, fading
    // out over a pixel and a half: a soft edge instead of a hard one.
    float soft = 1.5 * pixel;
    float alpha = 1.0 - smoothstep(0.0, soft, nearest);

    if (alpha <= 0.0) {
        gl_FragColor = vec4(0.0);

        return;
    }

    vec3 p = origin + ray * nearestAt;
    vec2 e = vec2(0.0008, 0.0);
    vec3 n = normalize(vec3(
        roundedBox(p + e.xyy) - roundedBox(p - e.xyy),
        roundedBox(p + e.yxy) - roundedBox(p - e.yxy),
        roundedBox(p + e.yyx) - roundedBox(p - e.yyx)
    ));
    vec3 facing = toScreen * n;

    vec3 colour = lava(p, n) * (0.84 + 0.52 * max(0.0, dot(facing, light)));
    colour = mix(vec3(dot(colour, vec3(0.299, 0.587, 0.114))), colour, 1.15);

    // Where the surface turns round an edge or a corner it glows.
    float bevel = 1.0 - max(abs(n.x), max(abs(n.y), abs(n.z)));
    colour += vec3(1.0, 0.8, 0.43) * smoothstep(0.0, 0.25, bevel) * 0.55;
    colour += vec3(1.0, 0.51, 0.12) * pow(1.0 - abs(dot(facing, -dir)), 3.0) * 0.35;

    gl_FragColor = vec4(clamp(colour, 0.0, 1.0) * alpha, alpha);
}`;

/** Direction the cube is lit from, in CSS axes. */
const LIGHT = [-0.36, -0.74, 0.57];

/** Radians per second around X, Y and Z: periods of 37, 26 and 59 seconds. */
const TURN = [(2 * Math.PI) / 37, (2 * Math.PI) / 26, (2 * Math.PI) / 59];

type Matrix = number[];

function rotateX(a: number): Matrix {
    return [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
}

function rotateY(a: number): Matrix {
    return [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
}

function rotateZ(a: number): Matrix {
    return [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
}

function multiply(a: Matrix, b: Matrix): Matrix {
    return a.map((_, i) => {
        const row = Math.floor(i / 3) * 3;
        const column = i % 3;

        return (
            a[row] * b[column] +
            a[row + 1] * b[3 + column] +
            a[row + 2] * b[6 + column]
        );
    });
}

function transpose(m: Matrix): Matrix {
    return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** Rotation of the cube at a moment, a slow tumble around all three axes. */
export function orientationAt(milliseconds: number): Matrix {
    const t = milliseconds / 1000;

    return multiply(
        rotateZ(t * TURN[2]),
        multiply(rotateY(0.73 + t * TURN[1]), rotateX(-0.56 + t * TURN[0])),
    );
}

function compile(
    gl: WebGLRenderingContext,
    type: number,
    source: string,
): WebGLShader {
    const shader = gl.createShader(type);

    if (!shader) {
        throw new Error('Cannot create a shader');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader failed');
    }

    return shader;
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        // The dev server serves assets from another origin; without CORS the
        // texture upload is refused.
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Cannot load ${url}`));
        image.src = url;
    });
}

/** Draws the cube into a canvas. Throws when WebGL is not available. */
export class RelicRenderer {
    private readonly gl: WebGLRenderingContext;

    private readonly toScreen: WebGLUniformLocation | null;

    private readonly toLocal: WebGLUniformLocation | null;

    private readonly pixel: WebGLUniformLocation | null;

    private readonly program: WebGLProgram;

    private readonly buffer: WebGLBuffer | null;

    private textures: WebGLTexture[] = [];

    constructor(private readonly canvas: HTMLCanvasElement) {
        const gl = canvas.getContext('webgl', {
            alpha: true,
            antialias: false,
            premultipliedAlpha: true,
        });

        if (!gl) {
            throw new Error('WebGL is not available');
        }

        const program = gl.createProgram();
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
        gl.attachShader(
            program,
            compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER),
        );
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program) ?? 'Link failed');
        }

        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            gl.STATIC_DRAW,
        );
        const corner = gl.getAttribLocation(program, 'corner');
        gl.enableVertexAttribArray(corner);
        gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

        gl.uniform3fv(gl.getUniformLocation(program, 'light'), LIGHT);
        gl.uniform1i(gl.getUniformLocation(program, 'textureA'), 0);
        gl.uniform1i(gl.getUniformLocation(program, 'textureB'), 1);

        this.gl = gl;
        this.program = program;
        this.buffer = buffer;
        this.toScreen = gl.getUniformLocation(program, 'toScreen');
        this.toLocal = gl.getUniformLocation(program, 'toLocal');
        this.pixel = gl.getUniformLocation(program, 'pixel');
    }

    /** Uploads the two lava textures; resolves once both are on the GPU. */
    async loadTextures(urlA: string, urlB: string): Promise<void> {
        const images = await Promise.all([loadImage(urlA), loadImage(urlB)]);
        const gl = this.gl;

        images.forEach((image, unit) => {
            const texture = gl.createTexture();
            this.textures.push(texture);
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                image,
            );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_S,
                gl.CLAMP_TO_EDGE,
            );
            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_T,
                gl.CLAMP_TO_EDGE,
            );
        });
    }

    /** Draws the cube as it stands at the given moment. */
    draw(milliseconds: number): void {
        const gl = this.gl;
        const pixels = Math.round(
            this.canvas.clientWidth * Math.min(2, window.devicePixelRatio || 1),
        );

        if (pixels > 0 && this.canvas.width !== pixels) {
            this.canvas.width = pixels;
            this.canvas.height = pixels;
            gl.viewport(0, 0, pixels, pixels);
        }

        // The canvas spans 1.8 cube edges.
        gl.uniform1f(this.pixel, 1.8 / this.canvas.width);

        const orientation = orientationAt(milliseconds);

        // WebGL reads matrices column by column, so the row-major rotation
        // goes in transposed and its inverse (the transpose) goes in as is.
        gl.uniformMatrix3fv(this.toScreen, false, transpose(orientation));
        gl.uniformMatrix3fv(this.toLocal, false, orientation);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /**
     * Frees what this renderer put on the GPU. The context itself stays: a
     * remount (React runs effects twice in development) gets it back from the
     * same canvas, and a lost context could not be used again.
     */
    dispose(): void {
        this.textures.forEach((texture) => this.gl.deleteTexture(texture));
        this.textures = [];
        this.gl.deleteBuffer(this.buffer);
        this.gl.deleteProgram(this.program);
    }
}
