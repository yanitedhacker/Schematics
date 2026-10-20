import { InspectionMotion } from "./inspection-motion.js";
import { createReferenceScene } from "./reference-scene.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const vertex = `attribute float objectId;attribute float groupId;
uniform float inspectObject;uniform float inspectPart;uniform float inspectAmount;uniform float inspectScale;uniform vec3 inspectCenter;uniform vec3 inspectDestination;uniform vec3 inspectLift;
uniform sampler2D transforms;uniform float isolated;uniform float assembly;uniform float activeObject;
varying vec3 n;varying float object;varying float part;
void main(){vec4 g=texture2D(transforms,vec2((groupId+.5)/32.,.5));vec3 p=position+g.xyz;object=objectId;part=g.w;n=normal;
bool inspecting=(inspectObject>=0.&&abs(objectId-inspectObject)<.1)||(inspectPart>=0.&&abs(part-inspectPart)<.1);
if(inspecting)p=inspectCenter+(p-inspectCenter)*mix(1.,inspectScale,inspectAmount)+(inspectDestination-inspectCenter)*inspectAmount+inspectLift*sin(inspectAmount*3.14159265);
gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
if((isolated>=0.&&abs(objectId-isolated)>.1)||(assembly>=0.&&abs(part-assembly)>.1))gl_Position=vec4(3.,3.,3.,1.);
}`;
const fragment = `precision highp float;varying vec3 n;varying float object;varying float part;uniform float activeObject;uniform float selectedPart;uniform float picking;uniform float ink;uniform float inspectObject;uniform float inspectPart;uniform float inspectAmount;
void main(){if(picking>.5){float id=object+1.;gl_FragColor=vec4(mod(id,256.)/255.,floor(id/256.)/255.,0.,1.);return;}
vec3 N=normalize(n);float light=abs(dot(N,normalize(vec3(-.3,-.5,1.))));float tone=light>.82?.97:light>.48?.92:light>.18?.86:.80;
vec3 col=vec3(tone*.984,tone*.994,tone*.977);if(ink>.5)col=vec3(.35,.41,.42);
if(activeObject>=0.&&abs(object-activeObject)<.1)col=mix(col,vec3(.22,.53,.54),ink>.5?.65:.25);
else if(selectedPart>=0.&&abs(part-selectedPart)>.1)col=mix(col,vec3(.969,.969,.949),.5);
bool inspecting=(inspectObject>=0.&&abs(object-inspectObject)<.1)||(inspectPart>=0.&&abs(part-inspectPart)<.1);
if(!inspecting)col=mix(col,vec3(.969,.969,.949),inspectAmount*.78);
gl_FragColor=vec4(col,1.);}`;
export class SolidView {
  constructor(canvas, meta, buffers, refresh) {
    this.inspection = new InspectionMotion();
    this.inspectionBox = new THREE.Box3();
    this.inspectionCenter = new THREE.Vector3();
    this.inspectionSize = new THREE.Vector3();
    this.inspectRight = new THREE.Vector3();
    this.inspectUp = new THREE.Vector3();
    this.inspectForward = new THREE.Vector3();
    this.inspectOffset = new THREE.Vector3();
    this.canvas = canvas;
    this.meta = meta;
    this.pieceIDs = Object.fromEntries(Object.keys(meta.pieces).map((k, i) => [k, i]));
    this.active = false;
    this.draws = 0;
    this.lastCpu = 0;
    this.gpuTimes = [];
    this.pending = [];
    this.onChange = refresh;
    this.apart = 0;
    this.selected = -1;
    this.isolated = -1;
    this.assembly = -1;
    this.profile = { skipDraw: false, skipEffects: false };
    this.engine = new THREE.WebGLRenderer({
      canvas,
      alpha: false,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.gl = this.engine.getContext();
    this.engine.setClearColor(0xf7f7f2);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-800, 800, 600, -600, 0.1, 20000);
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.minZoom = 0.15;
    this.controls.maxZoom = 5000;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.addEventListener("change", refresh);
    this.transformData = new Float32Array(32 * 4);
    this.texture = new THREE.DataTexture(this.transformData, 32, 1, THREE.RGBAFormat, THREE.FloatType);
    this.texture.needsUpdate = true;
    this.uniforms = {
      inspectObject: { value: -1 },
      inspectPart: { value: -1 },
      inspectAmount: { value: 0 },
      inspectScale: { value: 1 },
      inspectCenter: { value: new THREE.Vector3() },
      inspectDestination: { value: new THREE.Vector3() },
      inspectLift: { value: new THREE.Vector3() },
      transforms: { value: this.texture },
      isolated: { value: -1 },
      assembly: { value: -1 },
      activeObject: { value: -1 },
      selectedPart: { value: -1 },
      picking: { value: 0 },
      ink: { value: 0 },
    };
    const geo = new THREE.BufferGeometry();
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buffers.indices), 1));
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buffers.positions), 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(buffers.normals), 3));
    geo.setAttribute("objectId", new THREE.BufferAttribute(new Uint16Array(buffers.ids), 1));
    geo.setAttribute("groupId", new THREE.BufferAttribute(new Uint8Array(buffers.groups), 1));
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: this.uniforms,
        side: THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    const edge = new THREE.BufferGeometry();
    edge.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buffers.edges), 3));
    edge.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(buffers.edges.byteLength / 4), 3));
    edge.setAttribute("objectId", new THREE.BufferAttribute(new Uint16Array(buffers.edgeids), 1));
    edge.setAttribute("groupId", new THREE.BufferAttribute(new Uint8Array(buffers.edgegroups), 1));
    const eu = { ...this.uniforms, ink: { value: 1 } };
    this.edges = new THREE.LineSegments(
      edge,
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: eu,
        depthWrite: false,
      }),
    );
    this.edges.frustumCulled = false;
    this.scene.add(this.edges);
    this.reference = createReferenceScene();
    this.reference.group.visible = false;
    this.scene.add(this.reference.group);
    this.referenceMode = false;
    this.modelBox = new THREE.Box3Helper(new THREE.Box3(), 0x8c9d9a);
    this.modelBox.visible = false;
    this.scene.add(this.modelBox);
    this.showDimensions = false;
    this.effects = new THREE.Group();
    this.scene.add(this.effects);
    this.effectMaterial = new THREE.LineBasicMaterial({
      color: 0x71539e,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.timer = this.gl.getExtension("EXT_disjoint_timer_query_webgl2");
    const dbg = this.gl.getExtension("WEBGL_debug_renderer_info");
    this.identity = {
      renderer: dbg
        ? this.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : this.gl.getParameter(this.gl.RENDERER),
      antialias: this.gl.getContextAttributes().antialias,
    };
    this.resizeObserver = new ResizeObserver(() => {
      if (this.active) {
        this.resize();
        refresh();
      }
    });
    this.resizeObserver.observe(canvas.parentElement);
    this.home();
    let down = null;
    canvas.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
    canvas.addEventListener("pointerup", (e) => {
      if (e.button === 0 && down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 4)
        this.onPick?.(this.pick(e.clientX, e.clientY));
      down = null;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("dblclick", () => {
      if (!this.inspection.current) this.focus(this.selected);
    });
    canvas.addEventListener("pointercancel", () => (down = null));
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      this.onLoss?.();
    });
    canvas.addEventListener("webglcontextrestored", () => location.reload());
  }
  resize() {
    const b = this.canvas.parentElement.getBoundingClientRect();
    this.cssWidth = b.width;
    this.cssHeight = b.height;
    this.dpr = devicePixelRatio || 1;
    this.engine.setPixelRatio(this.dpr);
    this.engine.setSize(b.width, b.height, false);
    const a = b.width / b.height;
    this.camera.left = (-this.span * a) / 2;
    this.camera.right = (this.span * a) / 2;
    this.camera.top = this.span / 2;
    this.camera.bottom = -this.span / 2;
    this.camera.updateProjectionMatrix();
  }
  home() {
    if (this.referenceMode) {
      this.referenceHome();
      return;
    }
    const box = new THREE.Box3();
    for (const o of this.meta.objects) {
      box.expandByPoint(new THREE.Vector3(...o.bounds[0]));
      box.expandByPoint(new THREE.Vector3(...o.bounds[1]));
    }
    this.center = box.getCenter(new THREE.Vector3());
    this.fullRadius = box.getSize(new THREE.Vector3()).length() / 2;
    this.span = 1400;
    this.controls.target.copy(this.center);
    this.camera.zoom = 1;
    this.camera.position.copy(this.center).add(new THREE.Vector3(0.422, 0.794, 0.438).multiplyScalar(3500));
    this.resize();
    this.controls.update();
  }
  preset(view) {
    if (this.referenceMode && view === "top") {
      this.referenceHome();
      return;
    }
    const dirs = {
      front: [0.422, 0.794, 0.438],
      back: [-0.422, -0.794, 0.438],
      top: [0.001, 0.001, 1],
      bottom: [0.001, 0.001, -1],
    };
    this.camera.position
      .copy(this.controls.target)
      .add(new THREE.Vector3(...dirs[view]).normalize().multiplyScalar(3500));
    this.controls.update();
    this.onChange();
  }
  focus(id) {
    if (this.referenceMode) {
      this.focusReference(this.referenceSelected || "wafer");
      return;
    }
    const o = this.meta.objects[id];
    if (!o) return;
    const g = this.meta.groups[o.group],
      live = this.state?.[g.live] || [0, 0, 0],
      p = new THREE.Vector3(...o.center)
        .add(new THREE.Vector3(...g.move).multiplyScalar(this.apart))
        .add(new THREE.Vector3(...live));
    const delta = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(p);
    this.camera.position.copy(p).add(delta);
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera.zoom = Math.min(5000, (this.span * Math.min(1, aspect)) / (Math.max(o.radius, 0.04) * 2.8));
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.onChange();
  }
  select(id) {
    this.selected = id;
    this.uniforms.activeObject.value = id;
    this.onChange();
  }
  isolate(id, assembly = false) {
    this.returnInspection(true);
    this.isolated = assembly ? -1 : id;
    this.assembly = assembly ? id : -1;
    this.uniforms.isolated.value = this.isolated;
    this.uniforms.assembly.value = this.assembly;
    const o = this.meta.objects[this.isolated];
    this.mesh.geometry.setDrawRange(o ? o.indexStart : 0, o ? o.indexCount : Infinity);
    this.edges.geometry.setDrawRange(o ? o.edgeStart : 0, o ? o.edgeCount : Infinity);
    this.onChange();
  }
  setState(state, apart) {
    this.state = state;
    this.apart = apart;
    for (let i = 0; i < this.meta.groups.length; i++) {
      const g = this.meta.groups[i],
        l = state[g.live],
        o = i * 4;
      for (let j = 0; j < 3; j++) this.transformData[o + j] = g.move[j] * apart + (l ? l[j] : 0);
      this.transformData[o + 3] = this.pieceIDs[g.piece];
    }
    this.texture.needsUpdate = true;
    if (this.showDimensions && !this.referenceMode && !this.inspection.current && this.selected >= 0) {
      const o = this.meta.objects[this.selected],
        g = this.transformData.subarray(o.group * 4, o.group * 4 + 3);
      this.modelBox.box.min.set(...o.bounds[0]).add(new THREE.Vector3(...g));
      this.modelBox.box.max.set(...o.bounds[1]).add(new THREE.Vector3(...g));
      this.modelBox.visible = true;
    } else this.modelBox.visible = false;
  }
  inspect(selection, immediate = false) {
    if (this.referenceMode) return;
    if (selection.kind === "object" && !this.meta.objects[selection.id]) return;
    if (selection.kind === "assembly" && this.pieceIDs[selection.id] === undefined) return;
    if (this.isolated >= 0 || this.assembly >= 0) this.isolate(-1);
    this.inspection.request(selection, immediate);
    this.onChange();
  }
  returnInspection(immediate = false) {
    this.inspection.close(immediate);
    if (immediate) {
      this.uniforms.inspectObject.value = -1;
      this.uniforms.inspectPart.value = -1;
      this.uniforms.inspectAmount.value = 0;
    }
    this.onChange();
  }
  get inspectionMoving() {
    return this.inspection.moving;
  }
  updateInspection(seconds) {
    const m = this.inspection,
      u = this.uniforms;
    m.step(seconds);
    const s = m.current;
    u.inspectAmount.value = m.amount;
    u.inspectObject.value = s?.kind === "object" ? s.id : -1;
    u.inspectPart.value = s?.kind === "assembly" ? this.pieceIDs[s.id] : -1;
    if (!s) return;
    // Bounds include the current process and global explode offsets. Return therefore
    // meets the live machine pose, even when exposure continues during inspection.
    const box = this.inspectionBox.makeEmpty();
    if (this.inspectionSelection !== s) {
      this.inspectionSelection = s;
      this.inspectionFitZoom = this.camera.zoom;
      this.inspectionObjects =
        s.kind === "object" ? [this.meta.objects[s.id]] : this.meta.objects.filter((o) => o.piece === s.id);
    }
    const objects = this.inspectionObjects;
    for (const o of objects) {
      const k = o.group * 4,
        v = this.inspectOffset.set(
          this.transformData[k],
          this.transformData[k + 1],
          this.transformData[k + 2],
        );
      box.expandByPoint(this.inspectionSize.set(...o.bounds[0]).add(v));
      box.expandByPoint(this.inspectionSize.set(...o.bounds[1]).add(v));
    }
    const center = box.getCenter(this.inspectionCenter),
      radius = Math.max(0.04, box.getSize(this.inspectionSize).length() / 2),
      height = this.span / this.camera.zoom,
      width = (height * this.cssWidth) / this.cssHeight,
      narrow = this.cssWidth < 680;
    this.camera.updateMatrixWorld();
    this.inspectRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.inspectUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.inspectForward.setFromMatrixColumn(this.camera.matrixWorld, 2);
    u.inspectCenter.value.copy(center);
    u.inspectDestination.value
      .copy(this.controls.target)
      .addScaledVector(this.inspectRight, narrow ? 0 : -width * 0.14)
      .addScaledVector(this.inspectUp, narrow ? height * 0.18 : height * 0.025)
      .addScaledVector(this.inspectForward, 1000);
    const fitHeight = this.span / this.inspectionFitZoom,
      fitWidth = (fitHeight * this.cssWidth) / this.cssHeight;
    u.inspectScale.value =
      Math.min(fitHeight * (narrow ? 0.19 : 0.29), fitWidth * (narrow ? 0.34 : 0.25)) / radius;
    u.inspectLift.value.copy(this.inspectUp).multiplyScalar(Math.min(height * 0.11, 100));
  }
  projectReference(p) {
    const v = new THREE.Vector3(...p).project(this.camera);
    return [(v.x + 1) / 2, (1 - v.y) / 2];
  }
  referenceHome() {
    this.span = 52;
    this.camera.zoom = 1;
    this.controls.target.set(0, -1, 0);
    this.camera.position.set(0, -0.99, 3500);
    this.resize();
    this.controls.update();
    this.onChange();
  }
  setReference(on) {
    if (on === this.referenceMode) return;
    if (on) {
      this.savedCamera = {
        position: this.camera.position.clone(),
        target: this.controls.target.clone(),
        zoom: this.camera.zoom,
        span: this.span,
      };
      this.referenceMode = true;
      this.referenceHome();
    } else {
      this.referenceMode = false;
      const s = this.savedCamera;
      if (s) {
        this.span = s.span;
        this.camera.position.copy(s.position);
        this.controls.target.copy(s.target);
        this.camera.zoom = s.zoom;
        this.resize();
        this.controls.update();
      }
    }
    this.mesh.visible = !on;
    this.edges.visible = !on;
    this.reference.group.visible = on;
    this.modelBox.visible = false;
    this.onChange();
  }
  focusReference(name) {
    const o = this.reference.objects[name];
    if (!o) return;
    const b = new THREE.Box3().setFromObject(o),
      center = b.getCenter(new THREE.Vector3()),
      size = b.getSize(new THREE.Vector3()),
      delta = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(delta);
    this.camera.zoom =
      (this.span * Math.min(1, this.canvas.clientWidth / this.canvas.clientHeight)) /
      (Math.max(size.x, size.y) * 1.7);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.onChange();
  }
  setEffects(data) {
    if (this.effectPath) return;
    const path = data.shared.beam.path.concat(data.shared.pobMirrors.slice(1)),
      pts = path.map((p) => new THREE.Vector3(...p));
    this.effectPath = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.effectMaterial);
    this.effects.add(this.effectPath);
    const plasma = data.shared.beam.plasma,
      from = data.shared.beam.laserFrom || [plasma[0], 0, 6];
    this.laserPath = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        [[plasma[0], plasma[1], -300], from, plasma].map((p) => new THREE.Vector3(...p)),
      ),
      new THREE.LineBasicMaterial({ color: 0xb75030 }),
    );
    this.effects.add(this.laserPath);
    const route = [
      [-530, 149, 106],
      [-255, 104, 155.3],
      [-256, -24, 153.5],
      [-220, -24, 153.5],
      [-50, 0, 142.4],
      [-10, 0, 140],
      [110, 0, 140],
      [-50, 0, 142.4],
      [-364, -24, 185.5],
      [-220, -24, 153.5],
      [-392, 104, 187.3],
      [-530, 149, 106],
    ];
    this.routePath = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(route.map((p) => new THREE.Vector3(...p))),
      new THREE.LineBasicMaterial({ color: 0x247d82, transparent: true, opacity: 0.5 }),
    );
    this.effects.add(this.routePath);
    this.routeWafer = new THREE.Mesh(
      new THREE.CircleGeometry(15, 64),
      new THREE.MeshBasicMaterial({ color: 0x247d82, side: THREE.DoubleSide }),
    );
    this.effects.add(this.routeWafer);
  }
  draw(options) {
    if (this.lost) return;
    if (this.dpr !== devicePixelRatio) this.resize();
    const t = performance.now(),
      g = this.gl;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const q = this.pending[i];
      if (g.getQueryParameter(q, g.QUERY_RESULT_AVAILABLE)) {
        if (!g.getParameter(this.timer.GPU_DISJOINT_EXT))
          this.gpuTimes.push(g.getQueryParameter(q, g.QUERY_RESULT) / 1e6);
        g.deleteQuery(q);
        this.pending.splice(i, 1);
      }
    }
    this.effects.visible =
      !this.inspection.current &&
      !this.referenceMode &&
      this.apart < 0.02 &&
      this.isolated < 0 &&
      this.assembly < 0 &&
      !this.profile.skipEffects;
    this.effectPath.visible = options.optics;
    this.laserPath.visible = options.optics;
    this.routePath.visible = options.route;
    this.routeWafer.visible = options.running && options.route;
    if (this.state?.journey) this.routeWafer.position.set(...this.state.journey.at);
    const query = this.timer && this.draws % 30 === 0 ? g.createQuery() : null;
    if (query) g.beginQuery(this.timer.TIME_ELAPSED_EXT, query);
    if (!this.profile.skipDraw) this.engine.render(this.scene, this.camera);
    if (query) {
      g.endQuery(this.timer.TIME_ELAPSED_EXT);
      this.pending.push(query);
    }
    this.lastCpu = performance.now() - t;
    this.draws++;
  }
  pick(x, y) {
    if (this.referenceMode) {
      const b = this.canvas.getBoundingClientRect(),
        ray = new THREE.Raycaster();
      ray.setFromCamera(
        new THREE.Vector2(((x - b.x) / b.width) * 2 - 1, (-(y - b.y) / b.height) * 2 + 1),
        this.camera,
      );
      const hits = ray.intersectObjects(Object.values(this.reference.objects));
      return hits.length
        ? Object.keys(this.reference.objects).find((k) => this.reference.objects[k] === hits[0].object)
        : null;
    }
    const g = this.gl;
    if (!this.pickTarget)
      this.pickTarget = new THREE.WebGLRenderTarget(1, 1, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
      });
    const box = this.canvas.getBoundingClientRect(),
      d = this.dpr;
    this.camera.setViewOffset(
      this.canvas.width,
      this.canvas.height,
      Math.floor((x - box.left) * d),
      Math.floor((y - box.top) * d),
      1,
      1,
    );
    this.uniforms.picking.value = 1;
    this.edges.visible = false;
    const effects = this.effects.visible;
    this.effects.visible = false;
    this.engine.setRenderTarget(this.pickTarget);
    this.engine.setClearColor(0);
    this.engine.render(this.scene, this.camera);
    const p = new Uint8Array(4);
    this.engine.readRenderTargetPixels(this.pickTarget, 0, 0, 1, 1, p);
    this.engine.setRenderTarget(null);
    this.engine.setClearColor(0xf7f7f2);
    this.camera.clearViewOffset();
    this.uniforms.picking.value = 0;
    this.edges.visible = true;
    this.effects.visible = effects;
    this.onChange();
    return p[0] + p[1] * 256 - 1;
  }
}
