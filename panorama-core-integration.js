/* Panorama Personal -> Panorama Café Core
   Fuente real de sincronización: panorama_personal_state.
   La app existente ya mantiene ese estado en Supabase, por lo que no duplicamos
   otra sincronización desde el navegador. Core usa las tablas normalizadas.
*/
(function(){
  console.info('Panorama Core: integración directa desactivada; usando sincronización normalizada del estado existente.');
})();
