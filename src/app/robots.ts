import type { MetadataRoute } from "next";

// Cada página de Despesas fora do cache consome o limite compartilhado da fonte municipal.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/*/despesas?"],
    },
  };
}
