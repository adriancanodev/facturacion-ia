// Estado que devuelven las Server Actions de acceso usadas con useActionState.
// Va en un archivo aparte porque la documentación de Next 16 solo describe
// exportaciones de funciones async en los archivos "use server".
export type DemoActionState = {
  error: string | null;
};
