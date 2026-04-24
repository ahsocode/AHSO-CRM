import { afterEach } from "vitest";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.cookie
    .split(";")
    .map((entry) => entry.trim().split("=")[0])
    .filter(Boolean)
    .forEach((name) => {
      document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
    });
});
