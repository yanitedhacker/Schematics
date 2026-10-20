/* ---------- WebGL: tin plasma, droplets, the EUV beam and the CO2 beam ----------
   World space in the figure's camera (GLSL_ISO). Everything rides one envelope, uOn, from the
   source spring; droplets ride uRun. Light theme inks on paper (webgl.md, section 8). */
const glCanvas = stage.querySelector(".lc-gl");
const LIGHT_THEME = (root.closest("[data-theme]") || document.body).getAttribute("data-theme") === "light" ? 1 : 0;
const BEAM = (D.shared && D.shared.beam) || {};
const PATH = (BEAM.path && BEAM.path.length > 2 ? BEAM.path : [D.optic.IF, D.optic.facetField, D.optic.facetPupil, D.optic.relay, D.optic.reticle])
  .concat(((D.shared && D.shared.pobMirrors) || [D.optic.reticle, D.optic.m6, D.optic.wafer]).slice(1));
const MAXP = 16;
const pathFlat = new Float32Array(MAXP * 3);
PATH.slice(0, MAXP).forEach((p, i) => pathFlat.set(p, i * 3));
const v3 = (p) => `vec3(${p.map((x) => x.toFixed(2)).join(",")})`;
const PLASMA = BEAM.plasma || D.optic.plasma;
const IFP = BEAM.IF || D.optic.IF;
const RIM_R = BEAM.rimR || 32.5;
const RIM_Z = BEAM.rimZ || PLASMA[2] + 6;
const DROP_FROM = BEAM.dropFrom || [PLASMA[0] - 34, PLASMA[1], PLASMA[2]];
const DROP_TO = BEAM.dropTo || [PLASMA[0] + 34, PLASMA[1], PLASMA[2]];
const LASER_FROM = BEAM.laserFrom || [PLASMA[0], PLASMA[1], 6];

const FRAG = `
uniform float uOn;
uniform float uRun;
uniform float uLight;
uniform float uN;
uniform vec3 uPath[${MAXP}];
const vec3 PL=${v3(PLASMA)};
const vec3 IFP=${v3(IFP)};
const vec3 D0=${v3(DROP_FROM)};
const vec3 D1=${v3(DROP_TO)};
const vec3 LZ=${v3(LASER_FROM)};
const float RIMR=${RIM_R.toFixed(2)};
const float RIMZ=${RIM_Z.toFixed(2)};
float segDist(vec2 p,vec2 a,vec2 b,out float t){vec2 ab=b-a;t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-6),0.,1.);return length(p-a-ab*t);}
float glowSeg(vec2 vb,vec3 a,vec3 b,float w){float t;float d=segDist(vb,project(a),project(b),t)/uK;return exp(-(d*d)/(w*w));}
vec4 over(vec4 top,vec4 under){return top+under*(1.-top.a);}
vec4 inkFor(vec3 seen,float cover){vec3 ab=1.-seen;float a=max(max(ab.r,max(ab.g,ab.b)),cover);return vec4(vec3(a)-ab,a);}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  float px=pixelOf();
  // EUV cone: from the collector rim up to the intermediate focus, a soft volume whose half-width shrinks to zero at the IF
  vec2 c0=project(vec3(PL.xy,RIMZ));vec2 c1=project(IFP);
  vec2 ax=c1-c0;float L=length(ax);vec2 u=ax/max(L,1e-4);vec2 n=vec2(-u.y,u.x);
  float t=dot(vb-c0,u)/L;float s=abs(dot(vb-c0,n))/uK;
  float hw=RIMR*(1.-t);
  float inCone=smoothstep(0.,.06,t)*(1.-smoothstep(.97,1.,t))*(1.-smoothstep(hw-1.2-.7*px,hw+.7*px,s));
  float cone=inCone*(.35+.65*(1.-s/max(hw,.5)))*(.5+.5*t);
  // beam along the mirrors to the wafer
  float beam=0.;
  for(int i=0;i<${MAXP - 1};i++){if(float(i)>=uN-1.)break;beam=max(beam,glowSeg(vb,uPath[i],uPath[i+1],1.1));}
  float core=0.;
  for(int i=0;i<${MAXP - 1};i++){if(float(i)>=uN-1.)break;core=max(core,glowSeg(vb,uPath[i],uPath[i+1],.35));}
  // plasma: a flickering ball at the first focus, brightest on the main pulse
  float dp=length(vb-project(PL))/uK;
  float flick=.75+.25*sin(uTime*53.)*sin(uTime*31.7+1.3);
  float plasma=exp(-dp*dp/(2.2*2.2))*flick+.35*exp(-dp*dp/(9.*9.));
  // CO2 drive beam up through the collector hole
  float co2=glowSeg(vb,LZ,PL,.9);
  // tin droplets streaming across the plasma, each one vaporised there while the laser fires
  float drops=0.;
  float span=length(D1-D0);vec3 dd=(D1-D0)/span;
  for(int k=0;k<14;k++){
    float along=mod(uTime*9.+float(k)*span/14.,span);
    vec3 q=D0+dd*along;
    float pre=step(length(PL-D0)-.8,along);
    float gone=pre*uOn;
    float r=mix(.32,.55,smoothstep(length(PL-D0)-3.,length(PL-D0),along));
    float dq=length(vb-project(q))/uK;
    drops+=exp(-dq*dq/(r*r))*(1.-gone*smoothstep(length(PL-D0)-.2,length(PL-D0)+.4,along));
  }
  drops*=uRun;
  float on=uOn;
  vec3 euv=vec3(.55,.42,1.);
  vec3 red=vec3(1.,.22,.12);
  vec4 col;
  if(uLight<.5){
    vec3 c=euv*(cone*.55+beam*.6)*on+vec3(.9,.86,1.)*core*.8*on+vec3(1.,.95,1.)*plasma*1.6*on+red*co2*.9*on+vec3(.8,.82,.86)*drops*.9;
    c=tonemap(c,1.25);
    float m=max(c.r,max(c.g,c.b));
    float nz=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uTime*.37)*57.)-1.)/255.;
    c=max(c+nz*smoothstep(0.,1.5/255.,m),0.);
    col=vec4(c,max(c.r,max(c.g,c.b)));
  }else{
    float e1=1.-exp(-2.2*(cone*.5+beam*.7)*on);
    vec4 body=inkFor(mix(vec3(1.),vec3(.52,.40,.96),e1),0.)*smoothstep(0.,.02,e1);
    float e2=1.-exp(-2.6*core*on);
    vec4 hot=inkFor(mix(vec3(1.),vec3(.88,.84,1.),e2),.55*smoothstep(.5,.9,e2));
    float e3=1.-exp(-2.*plasma*on);
    vec4 pl=inkFor(mix(mix(vec3(1.),vec3(.55,.35,.98),smoothstep(0.,.5,e3)),vec3(.97,.95,1.),smoothstep(.6,.95,e3)),.9*smoothstep(.6,.95,e3));
    float e4=1.-exp(-2.4*co2*on);
    vec4 rd=inkFor(mix(vec3(1.),vec3(.93,.22,.12),e4),0.);
    float e5=1.-exp(-2.*drops);
    vec4 dr=inkFor(mix(vec3(1.),vec3(.42,.44,.48),e5),0.);
    col=over(pl,over(hot,over(dr,over(rd,body))));
    col.rgb=min(col.rgb,vec3(col.a));
    float nz=(hash12(gl_FragCoord.xy+fract(uTime*.61)*91.)-.5)/255.;
    col=max(col+vec4(nz)*smoothstep(0.,1.5/255.,col.a),0.);
  }
  gl_FragColor=col;
}`;

const glFx = glLayer({ canvas: glCanvas, fragment: FRAG, view: [D.W, D.H], camera: D.camera, uniforms: ["uOn", "uRun"], fixed: { uLight: LIGHT_THEME, uN: Math.min(MAXP, PATH.length), uPath: pathFlat } });
if (glFx) stage.setAttribute("data-gl", "");
const runEnv = { x: 0, v: 0 };
let glDrawn = false;
window.__lcFrame = (p, _groups, time) => {
  if (!glFx) return;
  const calm = still.matches;
  settle(runEnv, p.on ? 1 : 0, 1 / 60, 0.35, calm);
  const on = p.sourceOn;
  if (on < 1e-3 && runEnv.x < 1e-3) {
    if (glDrawn) { glFx.clear(); glDrawn = false; }
    return;
  }
  glFx.draw({ uOn: on, uRun: runEnv.x }, calm ? 0.8 : time);
  glDrawn = true;
};
