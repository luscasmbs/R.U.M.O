export const moduleConfigs = {
  epidemiology: {
    label: "Epidemiologia",
    categories: [["all", "Todas as doenças"], ["dengue", "Dengue"], ["chikungunya", "Chikungunya"], ["zika", "Zika"], ["influenza", "Influenza / gripe"]],
  },
  flood: {
    label: "Alagamentos",
    categories: [["all", "Todos os eventos hídricos"], ["rain_intense", "Chuva intensa"], ["river_level", "Cota de rio"], ["tide", "Maré alta"]],
  },
  landslide: {
    label: "Deslizamentos",
    categories: [["all", "Todos os movimentos de massa"], ["slope", "Instabilidade de encosta"], ["soil_saturation", "Solo saturado"], ["blocked_road", "Via interditada"]],
  },
  security: {
    label: "Segurança",
    categories: [["all", "Todas as ocorrências"], ["theft", "Furto e roubo"], ["violence", "Violência"], ["traffic", "Sinistro de trânsito"]],
  },
};

export const modules = Object.entries(moduleConfigs);

export function getCategoryLabel(module, category) {
  return moduleConfigs[module]?.categories.find(([value]) => value === category)?.[1] || category;
}
