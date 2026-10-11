export const isStudentPage=()=>globalThis.JOM_CONFIG?.audience==='student';
export function studentRoute(route){
 return ['home','solo','resources'].includes(route)||/^live-(join|play)(\/\d{6})?$/.test(route)?route:'live-join';
}
