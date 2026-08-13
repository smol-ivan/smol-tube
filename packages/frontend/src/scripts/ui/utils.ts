import { icons } from "lucide";

// Helper para convertir cualquier icono de Lucide a un string SVG con tus clases
export function renderIcon(
    iconName: keyof typeof icons,
    customClass: string = "size-4",
): string {
    const iconData = icons[iconName];
    if (!iconData) return "";

    // iconData es una tupla [tag, attrs, children]
    const [tag, attrs, children] = iconData;

    // Generar atributos dinámicos
    const mergedAttrs = {
        ...attrs,
        class: customClass,
        // Lucide usa stroke="currentColor" por defecto, por lo que heredará text-*
    };

    const attrString = Object.entries(mergedAttrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");

    const childrenString = children
        .map(([cTag, cAttrs]) => {
            const cAttrStr = Object.entries(cAttrs)
                .map(([k, v]) => `${k}="${v}"`)
                .join(" ");
            return `<${cTag} ${cAttrStr}></${cTag}>`;
        })
        .join("");

    return `<${tag} ${attrString}>${childrenString}</${tag}>`;
}
