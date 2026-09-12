/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_LOCAL_PREVIEW?: string;
  readonly VITE_DJANGO_API_URL?: string;
  readonly VITE_DJANGO_SAME_ORIGIN?: string;
}
