import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import ReviewForm from '../src/components/ReviewForm';
import ReviewsAdmin from '../src/components/ReviewsAdmin';
import ReviewsCarousel from '../src/components/ReviewsCarousel';
import ProjectGallery from '../src/components/ProjectGallery';
import ProjectManager from '../src/components/ProjectManager';
import HeroMedia from '../src/components/HeroMedia';
import type {Review} from '../src/config';
import {wrapLoopOffset} from '../src/utils/carousel';
import {asset} from '../src/config';
const reviews:Review[]=[1,2,3,4].map(id=>({id,name:`PRUEBA ${id}`,rating:5,comment:'Contenido técnico de prueba.',created:'2026-10-21T12:00:00Z',status:'approved'}));
test('Las rutas de Pages conservan el prefijo y no duplican ni alteran URLs externas',()=>{assert.equal(asset('/media/hero-mobile.mp4','/PaginaVibrados/'),'/PaginaVibrados/media/hero-mobile.mp4');assert.equal(asset('/PaginaVibrados/media/photo.jpg','/PaginaVibrados/'),'/PaginaVibrados/media/photo.jpg');assert.equal(asset('/','/PaginaVibrados/'),'/PaginaVibrados/');assert.equal(asset('https://example.com/photo.jpg','/PaginaVibrados/'),'https://example.com/photo.jpg');assert.equal(asset('/uploads/test.jpg','/'),'/uploads/test.jpg')});
test('La unión del bucle conserva la posición visual y la fracción de píxel en ambas direcciones',()=>{assert.equal(wrapLoopOffset(2000.5,1000),1000.5);assert.equal(wrapLoopOffset(999.5,1000),1999.5);assert.equal(wrapLoopOffset(7000.25,1000),1000.25);let position=1999.5;for(let frame=0;frame<120;frame++)position=wrapLoopOffset(position+.5,1000);assert.equal(position,1059.5)});
function motion(reduced:boolean){Object.defineProperty(globalThis,'window',{value:{matchMedia:()=>({matches:reduced})},configurable:true})}
test('La portada entrega un poster responsive antes de cargar video y conserva imagen con movimiento reducido',()=>{motion(true);const html=renderToStaticMarkup(<HeroMedia/>);assert.ok(html.includes('hero-postes-mobile-poster.jpg'));assert.ok(html.includes('hero-postes-desktop-poster.jpg'));assert.ok(html.includes('fetchPriority="high"'));assert.ok(!html.includes('<video'));assert.ok(!html.includes('Pausar video de fondo'))});
test('Movimiento reducido: una sola copia y sin reproducción automática',()=>{motion(true);const html=renderToStaticMarkup(<ReviewsCarousel reviews={reviews}/>);assert.equal((html.match(/class="review-card"/g)||[]).length,4);assert.ok(!html.includes('is-loop'));assert.ok(!html.includes('carousel-pause'));assert.ok(html.includes('Reseña siguiente'))});
test('Movimiento normal: tres grupos idénticos y control accesible de pausa',()=>{motion(false);const html=renderToStaticMarkup(<ReviewsCarousel reviews={reviews}/>);assert.equal((html.match(/class="carousel-group"/g)||[]).length,3);assert.equal((html.match(/class="review-card"/g)||[]).length,12);assert.ok(html.includes('aria-pressed="false"'));assert.ok(html.includes('aria-hidden="true"'));assert.ok(html.includes('tabindex="-1"'))});
test('Una reseña permanece estática y no duplica al cliente',()=>{motion(false);const html=renderToStaticMarkup(<ReviewsCarousel reviews={reviews.slice(0,1)}/>);assert.equal((html.match(/class="review-card"/g)||[]).length,1);assert.ok(!html.includes('carousel-pause'))});
test('Galería vacía: tres placeholders sin imágenes de proyectos inventados',()=>{const html=renderToStaticMarkup(<ProjectGallery projects={[]} loading={false} error=""/>);assert.equal((html.match(/PRÓXIMAMENTE/g)||[]).length,3);assert.ok(!html.includes('<img'));assert.ok(!html.includes('Filtrar trabajos'))});
test('Galería distingue video y cuenta los archivos; administrador acepta carga múltiple',()=>{const project={id:1,title:'PRUEBA',category:'',description:'',image:'',position:0,media:[{id:1,type:'video' as const,src:'/test.webm',alt:'Video de prueba',position:0},{id:2,type:'image' as const,src:'/test.jpg',alt:'Foto de prueba',position:1}]};const gallery=renderToStaticMarkup(<ProjectGallery projects={[project]} loading={false} error=""/>);assert.ok(gallery.includes('Reproducir PRUEBA'));assert.ok(gallery.includes('preload="metadata"'));assert.ok(!gallery.includes('autoPlay'));const admin=renderToStaticMarkup(<ProjectManager projects={[]} run={async fn=>{await fn()}}/>);assert.ok(admin.includes('multiple=""'));assert.ok(admin.includes('video/mp4,video/webm'))});


test('Los trabajos avanzan en bucle con pausa y las copias quedan fuera del teclado',()=>{
  motion(false);
  const projects=[1,2,3,4].map(id=>({id,title:`Trabajo ${id}`,category:'',description:'',image:`/photo-${id}.jpg`,position:id}));
  const html=renderToStaticMarkup(<ProjectGallery projects={projects} loading={false} error=""/>);
  assert.equal((html.match(/class="carousel-group"/g)||[]).length,3);
  assert.equal((html.match(/tabindex="-1"/g)||[]).length,8);
  assert.ok(html.includes('Trabajo siguiente'));
  assert.ok(html.includes('Pausar'));
  motion(true);
  const reduced=renderToStaticMarkup(<ProjectGallery projects={projects} loading={false} error=""/>);
  assert.equal((reduced.match(/class="carousel-group"/g)||[]).length,1);
  assert.ok(!reduced.includes('Pausar'));
});


test('La galería completa muestra una cuadrícula sin filtros ni copias del carrusel',()=>{
  motion(false);
  const projects=[1,2,3].map(id=>({id,title:`Trabajo ${id}`,category:'',description:'',image:`/photo-${id}.jpg`,position:id}));
  const html=renderToStaticMarkup(<ProjectGallery projects={projects} loading={false} error="" layout="grid"/>);
  assert.equal((html.match(/class="project"/g)||[]).length,3);
  assert.ok(html.includes('full-project-grid'));
  assert.ok(!html.includes('carousel-track'));
  assert.ok(!html.includes('Filtrar trabajos'));
});


test('Formulario de reseñas: descripción, imagen opcional, consentimiento y envío para revisión',()=>{
  const html=renderToStaticMarkup(<ReviewForm onClose={()=>{}} onPrivacy={()=>{}}/>);
  assert.ok(html.includes('Agregar una reseña'));
  assert.ok(html.includes('name="comment"'));
  assert.ok(html.includes('name="image"'));
  assert.ok(html.includes('name="consent"'));
  assert.ok(html.includes('Enviar para revisión'));
  assert.ok(!html.includes('wa.me'));
});
test('El panel de reseñas no muestra datos ni controles de moderación antes de comprobar la sesión',()=>{
  const html=renderToStaticMarkup(<ReviewsAdmin/>);
  assert.ok(html.includes('Comprobando sesión'));
  assert.ok(!html.includes('Aprobar y publicar'));
  assert.ok(!html.includes('PROYECTOS'));
});


test('Las reseñas se pueden abrir con teclado y las imágenes del carrusel conservan acceso al detalle',()=>{
  motion(false);
  const review={...reviews[0],name:'Cliente de prueba',image:'/photo.jpg'};
  const html=renderToStaticMarkup(<ReviewsCarousel reviews={[review]}/>);
  assert.ok(html.includes('role="button"'));
  assert.ok(html.includes('tabindex="0"'));
  assert.ok(html.includes('Ver reseña completa de Cliente de prueba'));
  assert.ok(html.includes('Ver reseña completa'));
  assert.ok(html.includes('review-work-photo'));
});
