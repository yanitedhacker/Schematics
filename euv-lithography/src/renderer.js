const BG = [0.969, 0.969, 0.949];
const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 pos;
layout(location=1) in float depth;
layout(location=2) in vec4 color;
layout(location=3) in float groupId;
layout(location=4) in float pieceId;
layout(location=5) in float lineKind;
uniform sampler2D groups;
uniform vec4 view;
uniform float selected;
uniform float pick;
uniform float contextFade;
out vec4 col;
flat out float id;
void main(){
 vec4 g=texelFetch(groups,ivec2(int(groupId),0),0);
 vec2 p=pos+g.xy;
 gl_Position=vec4((p.x-view.x)/view.z*2.-1.,1.-(p.y-view.y)/view.w*2.,clamp(-(depth+g.z)/1024.,-.95,.95),1.);
 col=color;id=pieceId;
 if(g.w<.5){gl_Position=vec4(3.,3.,3.,1.);col.a=0.;}
 if(pick<.5){
  if(selected>=0.&&abs(pieceId-selected)>.1)col.rgb=mix(col.rgb,vec3(.969,.969,.949),.52);
  if(contextFade>.5&&abs(pieceId-7.)<.1)col.rgb=mix(col.rgb,vec3(.969,.969,.949),.4);
 }
}`;
const FRAG = `#version 300 es
precision highp float;
in vec4 col;
flat in float id;
uniform float pick;
out vec4 outColor;
void main(){if(col.a<.015)discard;if(pick>.5)outColor=vec4((id+1.)/255.,0.,0.,1.);else outColor=col;}`;
function shader(gl, type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
  return s;
}
export class Renderer {
  constructor(canvas, meta, vertices, indices, data) {
    this.canvas = canvas;
    this.meta = meta;
    this.data = data;
    this.opticalPath = data.shared.beam.path.concat(data.shared.pobMirrors.slice(1));
    this.rayA = [0, 0, 0];
    this.rayB = [0, 0, 0];
    this.lost = false;
    this.lastCpu = 0;
    this.draws = 0;
    const gl = (this.gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    }));
    if (!gl) throw Error("WebGL2 is required. Open this copy in a browser with WebGL2 enabled.");
    this.program = gl.createProgram();
    gl.attachShader(this.program, shader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(this.program, shader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(this.program));
    this.locations = Object.fromEntries(
      ["groups", "view", "selected", "pick", "contextFade"].map((k) => [
        k,
        gl.getUniformLocation(this.program, k),
      ]),
    );
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const attr = (i, n, type, normal, offset) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, n, type, normal, 20, offset);
    };
    attr(0, 2, gl.FLOAT, false, 0);
    attr(1, 1, gl.FLOAT, false, 8);
    attr(2, 4, gl.UNSIGNED_BYTE, true, 12);
    attr(3, 1, gl.UNSIGNED_BYTE, false, 16);
    attr(4, 1, gl.UNSIGNED_BYTE, false, 17);
    attr(5, 1, gl.UNSIGNED_BYTE, false, 18);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this.count = meta.indices;
    this.groupData = new Float32Array(32 * 4);
    for (let i = 0; i < 32; i++) this.groupData[i * 4 + 3] = 1;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 32, 1, 0, gl.RGBA, gl.FLOAT, this.groupData);
    this.fxVao = gl.createVertexArray();
    gl.bindVertexArray(this.fxVao);
    this.fxBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuffer);
    const fxattr = (i, n, off) => {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, n, gl.FLOAT, false, 40, off);
    };
    fxattr(0, 2, 0);
    fxattr(1, 1, 8);
    fxattr(2, 4, 12);
    fxattr(3, 1, 28);
    fxattr(4, 1, 32);
    fxattr(5, 1, 36);
    this.fxCapacity = 400000;
    gl.bufferData(gl.ARRAY_BUFFER, this.fxCapacity, gl.DYNAMIC_DRAW);
    this.fx = new Float32Array(this.fxCapacity / 4);
    this.fxLength = 0;
    this.selected = -1;
    this.apart = 0;
    this.view = [0, 0, 1440, 1180];
    this.mode = "cell";
    this.detail = "full";
    this.zoom = 1;
    this.pan = [0, 0];
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.dpr = devicePixelRatio || 1;
    this.resizeObserver = new ResizeObserver((entries) => {
      const b = entries[0].contentRect;
      this.resize(b.width, b.height);
      this.onResize?.();
    });
    this.resizeObserver.observe(canvas);
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    this.timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    this.gpuTimes = [];
    this.pendingQueries = [];
    this.identity = {
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      antialias: gl.getContextAttributes().antialias,
    };
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      this.onLoss?.();
    });
    canvas.addEventListener("webglcontextrestored", () => this.onRestore?.());
  }
  resize(w, h) {
    const ratio = devicePixelRatio || 1;
    this.dpr = ratio;
    this.cssWidth = w;
    this.cssHeight = h;
    this.canvas.width = Math.max(1, Math.round(w * ratio));
    this.canvas.height = Math.max(1, Math.round(h * ratio));
    this.fitView();
    this.destroyPick();
  }
  fitView() {
    const presets = {
      cell: [0, 0, 1440, 1180],
      optics: [650, 140, 600, 540],
      track: [60, 160, 700, 610],
      laser: [760, 740, 620, 430],
    };
    const b = presets[this.mode] || presets.cell,
      aspect = this.cssWidth / Math.max(1, this.cssHeight),
      bw = b[2] / this.zoom,
      bh = b[3] / this.zoom;
    let w = bw,
      h = bh;
    if (w / h > aspect) h = w / aspect;
    else w = h * aspect;
    this.view = [b[0] + b[2] / 2 - w / 2 + this.pan[0], b[1] + b[3] / 2 - h / 2 + this.pan[1], w, h];
    const scale = this.cssWidth / w;
    this.levelName = this.detail === "full" || scale >= 1.7 ? "full" : scale >= 0.85 ? "medium" : "coarse";
    this.currentLevel = this.meta.levels[this.levelName];
  }
  project(p) {
    const D = this.data;
    return [
      D.camera.origin[0] + D.EX[0] * p[0] + D.EY[0] * p[1],
      D.camera.origin[1] + D.EX[1] * p[0] + D.EY[1] * p[1] + D.EZ[1] * p[2],
    ];
  }
  offset(v) {
    const D = this.data;
    return [
      D.EX[0] * v[0] + D.EY[0] * v[1],
      D.EX[1] * v[0] + D.EY[1] * v[1] + D.EZ[1] * v[2],
      v[0] * D.V[0] + v[1] * D.V[1] + v[2] * D.V[2],
    ];
  }
  setState(state, apart) {
    this.state = state;
    this.apart = apart;
    const D = this.data,
      out = this.groupData;
    for (let i = 0; i < this.meta.groups.length; i++) {
      const group = this.meta.groups[i],
        live = state[group.live],
        x = group.move[0] * apart + (live ? live[0] : 0),
        y = group.move[1] * apart + (live ? live[1] : 0),
        z = group.move[2] * apart + (live ? live[2] : 0),
        o = i * 4;
      out[o] = D.EX[0] * x + D.EY[0] * y;
      out[o + 1] = D.EX[1] * x + D.EY[1] * y + D.EZ[1] * z;
      out[o + 2] = x * D.V[0] + y * D.V[1] + z * D.V[2];
      out[o + 3] = group.live === "wafer" ? 0 : 1;
    }
  }
  emitFx(x, y, z, color, piece = 30) {
    const a = this.fx,
      o = this.fxLength;
    a[o] = x;
    a[o + 1] = y;
    a[o + 2] = z;
    a[o + 3] = color[0];
    a[o + 4] = color[1];
    a[o + 5] = color[2];
    a[o + 6] = color[3];
    a[o + 7] = 31;
    a[o + 8] = piece;
    a[o + 9] = 0;
    this.fxLength += 10;
  }

  vertex(p, color, piece = 30) {
    const D = this.data,
      x = p[0],
      y = p[1],
      z = p[2];
    this.emitFx(
      D.camera.origin[0] + D.EX[0] * x + D.EY[0] * y,
      D.camera.origin[1] + D.EX[1] * x + D.EY[1] * y + D.EZ[1] * z,
      x * D.V[0] + y * D.V[1] + z * D.V[2] + 0.04,
      color,
      piece,
    );
  }
  tri(a, b, c, color, piece = 30) {
    for (const p of [a, b, c]) this.vertex(p, color, piece);
  }
  line(a, b, color, width = 0.75, piece = 30) {
    const D = this.data,
      ax = D.camera.origin[0] + D.EX[0] * a[0] + D.EY[0] * a[1],
      ay = D.camera.origin[1] + D.EX[1] * a[0] + D.EY[1] * a[1] + D.EZ[1] * a[2],
      bx = D.camera.origin[0] + D.EX[0] * b[0] + D.EY[0] * b[1],
      by = D.camera.origin[1] + D.EX[1] * b[0] + D.EY[1] * b[1] + D.EZ[1] * b[2];
    const dx = bx - ax,
      dy = by - ay,
      length = Math.hypot(dx, dy) || 1,
      w = (width * this.view[2]) / Math.max(1, this.cssWidth),
      nx = ((-dy / length) * w) / 2,
      ny = ((dx / length) * w) / 2,
      za = a[0] * D.V[0] + a[1] * D.V[1] + a[2] * D.V[2] + 0.08,
      zb = b[0] * D.V[0] + b[1] * D.V[1] + b[2] * D.V[2] + 0.08;
    this.emitFx(ax + nx, ay + ny, za, color, piece);
    this.emitFx(ax - nx, ay - ny, za, color, piece);
    this.emitFx(bx + nx, by + ny, zb, color, piece);
    this.emitFx(bx + nx, by + ny, zb, color, piece);
    this.emitFx(ax - nx, ay - ny, za, color, piece);
    this.emitFx(bx - nx, by - ny, zb, color, piece);
  }
  disc(center, r, color, piece = 30) {
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2,
        b = ((i + 1) / 40) * Math.PI * 2;
      this.tri(
        center,
        [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a), center[2]],
        [center[0] + r * Math.cos(b), center[1] + r * Math.sin(b), center[2]],
        color,
        piece,
      );
    }
  }
  buildEffects(options) {
    this.fxLength = 0;
    const s = this.state,
      D = this.data,
      beam = D.shared.beam,
      ring = beam.collectorRim,
      IF = beam.IF;
    if (options.route) {
      const route = options.journey;
      for (let i = 1; i < route.length; i++)
        this.line(route[i - 1].at, route[i].at, [0.05, 0.48, 0.53, 0.38], 1.4);
    }
    if (this.apart < 0.02 && options.running) {
      const p = s.journey.at;
      this.disc([p[0], p[1], p[2] + 0.4], 15, [0.1, 0.53, 0.57, 0.9]);
    }
    if (this.apart > 0.015 || !options.optics) return;
    const lit = options.running ? (s.lit ? 1 : 0.45) : 0.65;
    for (let i = 0; i < ring.length; i += 2)
      this.tri(ring[i], ring[(i + 2) % ring.length], IF, [0.47, 0.33, 0.75, 0.045 * lit]);
    // An illustrative ray bundle follows mirror centres. It is not an imaging solver.
    const path = this.opticalPath;
    for (const spread of [-0.5, 0, 0.5])
      for (let i = 1; i < path.length; i++) {
        const a = this.rayA,
          b = this.rayB;
        for (let j = 0; j < 3; j++) {
          a[j] = path[i - 1][j];
          b[j] = path[i][j];
        }
        a[1] += spread;
        b[1] += spread;
        this.line(a, b, [0.42, 0.28, 0.69, 0.7 * lit], spread === 0 ? 1.5 : 0.6);
      }
    const plasma = beam.plasma;
    this.line([plasma[0], plasma[1], -300], [plasma[0], plasma[1], 0], [0.78, 0.26, 0.14, 0.65 * lit], 1.6);
    const laserFrom = beam.laserFrom || [plasma[0], 0, 6];
    this.line(laserFrom, plasma, [0.78, 0.26, 0.14, 0.8 * lit], 1.5);
    this.disc([plasma[0], plasma[1], plasma[2] + 0.1], 2.5, [0.7, 0.42, 0.82, 0.8 * lit]);
    const w = D.optic.wafer;
    const corners = [
      [-0.1, -1.3],
      [0.1, -1.3],
      [0.1, 1.3],
      [-0.1, 1.3],
    ].map(([x, y]) => [w[0] + x, w[1] + y, w[2] + 0.15]);
    this.tri(corners[0], corners[1], corners[2], [0.38, 0.18, 0.75, 0.85 * lit]);
    this.tri(corners[0], corners[2], corners[3], [0.38, 0.18, 0.75, 0.85 * lit]);
  }
  prepare(pick = false) {
    const g = this.gl;
    g.useProgram(this.program);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, this.texture);
    g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, 32, 1, g.RGBA, g.FLOAT, this.groupData);
    g.uniform1i(this.locations.groups, 0);
    g.uniform4fv(this.locations.view, this.view);
    g.uniform1f(this.locations.selected, this.selected);
    g.uniform1f(this.locations.pick, pick ? 1 : 0);
    g.uniform1f(this.locations.contextFade, this.mode === "optics" ? 1 : 0);
    g.enable(g.DEPTH_TEST);
    g.depthFunc(g.LEQUAL);
    g.depthMask(true);
    g.disable(g.CULL_FACE);
    g.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  draw(options) {
    if (this.lost || !this.cssWidth) return;
    if (this.dpr !== (devicePixelRatio || 1)) this.resize(this.cssWidth, this.cssHeight);
    const t = performance.now(),
      g = this.gl;
    for (let i = this.pendingQueries.length - 1; i >= 0; i--) {
      const q = this.pendingQueries[i];
      if (g.getQueryParameter(q, g.QUERY_RESULT_AVAILABLE)) {
        if (!g.getParameter(this.timer.GPU_DISJOINT_EXT))
          this.gpuTimes.push(g.getQueryParameter(q, g.QUERY_RESULT) / 1e6);
        g.deleteQuery(q);
        this.pendingQueries.splice(i, 1);
      }
    }
    const query = this.timer && this.draws % 60 === 0 ? g.createQuery() : null;
    if (query) g.beginQuery(this.timer.TIME_ELAPSED_EXT, query);
    this.prepare();
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.clearColor(...BG, 1);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
    g.bindVertexArray(this.vao);
    g.drawElements(g.TRIANGLES, this.currentLevel.count, g.UNSIGNED_INT, this.currentLevel.byteOffset);
    this.buildEffects(options);
    if (this.fxLength) {
      g.bindVertexArray(this.fxVao);
      g.bindBuffer(g.ARRAY_BUFFER, this.fxBuffer);
      g.bufferSubData(g.ARRAY_BUFFER, 0, this.fx.subarray(0, this.fxLength));
      g.depthMask(false);
      if (this.mode === "optics") g.disable(g.DEPTH_TEST);
      g.uniform1f(this.locations.selected, -1);
      g.drawArrays(g.TRIANGLES, 0, this.fxLength / 10);
      g.depthMask(true);
    }
    if (query) {
      g.endQuery(this.timer.TIME_ELAPSED_EXT);
      this.pendingQueries.push(query);
    }
    this.lastCpu = performance.now() - t;
    this.draws++;
  }
  destroyPick() {
    const g = this.gl;
    if (this.pickTarget) {
      g.deleteFramebuffer(this.pickTarget.fb);
      g.deleteTexture(this.pickTarget.tex);
      g.deleteRenderbuffer(this.pickTarget.depth);
      this.pickTarget = null;
    }
  }
  pick(clientX, clientY) {
    if (this.lost) return -1;
    const g = this.gl;
    if (!this.pickTarget) {
      const fb = g.createFramebuffer(),
        tex = g.createTexture(),
        depth = g.createRenderbuffer();
      g.bindTexture(g.TEXTURE_2D, tex);
      g.texImage2D(
        g.TEXTURE_2D,
        0,
        g.RGBA8,
        this.canvas.width,
        this.canvas.height,
        0,
        g.RGBA,
        g.UNSIGNED_BYTE,
        null,
      );
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
      g.bindRenderbuffer(g.RENDERBUFFER, depth);
      g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT24, this.canvas.width, this.canvas.height);
      g.bindFramebuffer(g.FRAMEBUFFER, fb);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
      g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, depth);
      if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
        throw Error("Picking framebuffer is incomplete");
      this.pickTarget = { fb, tex, depth };
    }
    g.bindFramebuffer(g.FRAMEBUFFER, this.pickTarget.fb);
    this.prepare(true);
    g.disable(g.BLEND);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    g.bindVertexArray(this.vao);
    g.drawElements(g.TRIANGLES, this.currentLevel.count, g.UNSIGNED_INT, this.currentLevel.byteOffset);
    const box = this.canvas.getBoundingClientRect(),
      px = new Uint8Array(4),
      x = Math.floor((clientX - box.left) * this.dpr),
      y = this.canvas.height - 1 - Math.floor((clientY - box.top) * this.dpr);
    g.readPixels(x, y, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    return px[0] - 1;
  }
}
