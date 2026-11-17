/* The existing Back Room is the only entry. Embedded same-origin editor stays functional. */
(()=>{
 let embeddedInOwnBackroom=false;
 try{
  embeddedInOwnBackroom=window.parent!==window&&window.parent.location.origin===window.location.origin;
 }catch(_){}
 if(!embeddedInOwnBackroom)window.location.replace('./');
})();
