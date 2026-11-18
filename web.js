/* Comanda · capa web (Firebase). Se carga antes del script principal.
   Da a la app lo mismo que le daba Claude: base de datos, descargas y archivos. */
(function(){
  const CFG={apiKey:"AIzaSyBp0WJUOo9CJPMrl7lRW52vJbUGUDA-eUI",authDomain:"nobleza-comanda.firebaseapp.com",projectId:"nobleza-comanda",storageBucket:"nobleza-comanda.firebasestorage.app",messagingSenderId:"1031198902004",appId:"1:1031198902004:web:9d12ab5e0105baaef4c0a1"};
  const RANGO=new Set(['<','<=','>','>=','!=','not-in']);

  /* ---- limpia datos para Firestore: quita undefined y traduce {__delete__:true} ---- */
  function limpiar(v,update,top){
    if(Array.isArray(v))return v.map(x=>limpiar(x,false,false)).filter(x=>x!==undefined);
    if(v&&typeof v==='object'&&!(v instanceof Date)&&!(v instanceof Blob)){
      if(v.__delete__===true)return update&&top?firebase.firestore.FieldValue.delete():undefined;
      const o={};for(const [k,x] of Object.entries(v)){const c=limpiar(x,update,false);if(c!==undefined)o[k]=c}return o}
    if(typeof v==='number'&&!isFinite(v))return null;
    return v;
  }
  const limpiarDoc=(d,update)=>{const o={};for(const [k,x] of Object.entries(d||{})){const c=limpiar(x,update,true);if(c!==undefined)o[k]=c}return o};

  /* ---- consultas: si mezclan "igual a" con un rango en otro campo, el "igual a" se aplica aquí
     (así no hace falta crear índices compuestos en Firebase) ---- */
  function cumple(d,[f,op,v]){const x=d.get(f);if(op==='==')return x===v;if(op==='in')return Array.isArray(v)&&v.includes(x);if(op==='array-contains')return Array.isArray(x)&&x.includes(v);return true}
  function snapDe(docs){return {docs,size:docs.length,empty:!docs.length,forEach:cb=>docs.forEach(cb)}}
  function consulta(ref,filtros,lim,orden){
    const plan=()=>{const rf=new Set(filtros.filter(f=>RANGO.has(f[1])).map(f=>f[0]));
      const local=rf.size?filtros.filter(f=>!RANGO.has(f[1])&&!rf.has(f[0])):[];
      let q=ref;filtros.filter(f=>!local.includes(f)).forEach(f=>{q=q.where(...f)});orden.forEach(o=>{q=q.orderBy(...o)});
      if(lim&&!local.length)q=q.limit(lim);
      const tratar=s=>{let ds=s.docs;if(local.length)ds=ds.filter(d=>local.every(f=>cumple(d,f)));if(lim)ds=ds.slice(0,lim);return snapDe(ds)};
      return {q,tratar}};
    return {
      where:(...f)=>consulta(ref,[...filtros,f],lim,orden),
      limit:n=>consulta(ref,filtros,n,orden),
      orderBy:(...o)=>consulta(ref,filtros,lim,[...orden,o]),
      doc:id=>documento(id?ref.doc(id):ref.doc()),
      add:d=>ref.add(limpiarDoc(d,false)),
      get:()=>{const {q,tratar}=plan();return q.get().then(tratar)},
      onSnapshot:(cb,er)=>{const {q,tratar}=plan();return q.onSnapshot(s=>cb(tratar(s)),er)}
    };
  }
  function documento(r){return {id:r.id,path:r.path,
    get:()=>r.get(),set:(d,o)=>r.set(limpiarDoc(d,false),o||{}),update:d=>r.update(limpiarDoc(d,true)),delete:()=>r.delete(),
    collection:p=>consulta(r.collection(p),[],null,[]),onSnapshot:(cb,er)=>r.onSnapshot(cb,er)}}
  function base(fs){return {collection:p=>consulta(fs.collection(p),[],null,[]),doc:p=>documento(fs.doc(p))}}

  /* ---- descargas ---- */
  const descargas={save:async({filename,data})=>{const b=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(b);
    const a=document.createElement('a');a.href=u;a.download=filename||'archivo';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);return {ok:true}}};

  /* ---- archivos (comprobantes y facturas): se guardan comprimidos en la base de datos ---- */
  const leer=f=>new Promise((ok,mal)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=mal;r.readAsDataURL(f)});
  async function comprimir(f){const url=await leer(f);if(!/^image\//.test(f.type||''))return url;
    const img=await new Promise((ok,mal)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=mal;i.src=url});
    let w=img.naturalWidth,h=img.naturalHeight,m=1600;if(Math.max(w,h)>m){const k=m/Math.max(w,h);w=Math.round(w*k);h=Math.round(h*k)}
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
    for(const q of [0.75,0.6,0.45]){const d=c.toDataURL('image/jpeg',q);if(d.length<900000)return d}
    const c2=document.createElement('canvas');c2.width=Math.round(w/2);c2.height=Math.round(h/2);c2.getContext('2d').drawImage(c,0,0,c2.width,c2.height);return c2.toDataURL('image/jpeg',0.6)}
  let FS=null;
  const archivos={upload:async(f)=>{const data=await comprimir(f);if(data.length>950000)throw new Error('El archivo es muy grande. Mándalo como foto.');
    const ref=await FS.collection('archivos').add({data,tipo:f.type||'',nombre:f.name||'',creado:new Date().toISOString()});return {id:ref.id}}};
  document.addEventListener('click',async e=>{const a=e.target.closest&&e.target.closest('a[href^="/_blob/"]');if(!a||!FS)return;e.preventDefault();
    const w=window.open('','_blank');try{const d=await FS.collection('archivos').doc(a.getAttribute('href').slice(7)).get();if(!d.exists){if(w)w.close();alertar('No encontré ese archivo.');return}
      const b=await (await fetch(d.data().data)).blob();const u=URL.createObjectURL(b);if(w)w.location=u;else location.href=u}catch(err){if(w)w.close();alertar('No se pudo abrir el archivo.')}},true);
  function alertar(t){try{toast(t)}catch(e){}}

  /* ---- pantalla para conectar el dispositivo (solo la primera vez) ---- */
  function pantallaLogin(){return new Promise(ok=>{
    const d=document.createElement('div');d.id='webLogin';
    d.innerHTML=`<div class="wl-box"><h1>Comanda</h1><p>Nobleza Beauty Room</p><small>Conecta este dispositivo al salón. Solo se hace una vez.</small>
      <form id="wlForm" novalidate><label class="f">Correo del salón<input id="wlMail" type="email" autocomplete="username" required></label>
      <label class="f">Contraseña<input id="wlPass" type="password" autocomplete="current-password" required></label>
      <button class="btn primary big" id="wlBtn">Conectar</button><small id="wlMsg" class="neg"></small></form></div>`;
    document.body.appendChild(d);
    d.querySelector('#wlForm').addEventListener('submit',async e=>{e.preventDefault();const b=d.querySelector('#wlBtn'),m=d.querySelector('#wlMsg');m.textContent='';b.disabled=true;b.textContent='Conectando…';
      try{await firebase.auth().signInWithEmailAndPassword(d.querySelector('#wlMail').value.trim(),d.querySelector('#wlPass').value);d.remove();ok()}
      catch(err){const c=err&&err.code||'';m.textContent=/invalid|wrong|user-not-found/.test(c)?'Correo o contraseña incorrectos.':/network/.test(c)?'No hay internet. Revisa la conexión.':/too-many/.test(c)?'Demasiados intentos. Espera unos minutos.':'No se pudo conectar ('+c+').';b.disabled=false;b.textContent='Conectar'}})})}

  window.WEB={
    activo:()=>typeof firebase!=='undefined',
    desconectar:async()=>{try{await firebase.auth().signOut()}catch(e){}location.reload()},
    iniciar:async(listo)=>{
      firebase.initializeApp(CFG);
      const fs=firebase.firestore();try{fs.settings({ignoreUndefinedProperties:true,merge:true})}catch(e){}
      FS=fs;
      const u=await new Promise(ok=>{const off=firebase.auth().onAuthStateChanged(x=>{off();ok(x)})});
      if(!u){try{banner('')}catch(e){}await pantallaLogin()}
      firebase.auth().onAuthStateChanged(x=>{if(!x)location.reload()});
      listo({db:base(fs),dl:descargas,assets:archivos});
    },
    _prueba:{base,limpiarDoc}
  };
})();
