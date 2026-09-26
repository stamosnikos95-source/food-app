import Svg, { Circle, Path } from "react-native-svg";

export type IconName = "bowl" | "assistant" | "bag" | "user" | "plus" | "minus" | "arrowRight";

interface IconProps {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Line icons drawn as SVG (24px grid, round caps) rather than an icon font:
 * no extra font file to download on web, and crisp at any size.
 */
export function Icon({ name, color, size = 24, strokeWidth = 1.75 }: IconProps) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "bowl" && (
        <>
          <Path d="M3 11h18" {...stroke} />
          <Path d="M4 11a8 8 0 0 0 16 0" {...stroke} />
          <Path d="M9.5 8c0-1.3 1-1.5 1-3M13.5 8c0-1.3 1-1.5 1-3" {...stroke} />
        </>
      )}
      {name === "assistant" && (
        <>
          <Path d="M11 4l1.9 5.1L18 11l-5.1 1.9L11 18l-1.9-5.1L4 11l5.1-1.9z" {...stroke} />
          <Path d="M19 3v3M17.5 4.5h3" {...stroke} />
        </>
      )}
      {name === "bag" && (
        <>
          <Path d="M5 8h14l-1 13H6z" {...stroke} />
          <Path d="M9 8V7a3 3 0 0 1 6 0v1" {...stroke} />
        </>
      )}
      {name === "user" && (
        <>
          <Circle cx="12" cy="8" r="4" {...stroke} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...stroke} />
        </>
      )}
      {name === "plus" && <Path d="M12 5v14M5 12h14" {...stroke} />}
      {name === "minus" && <Path d="M5 12h14" {...stroke} />}
      {name === "arrowRight" && <Path d="M5 12h14M13 6l6 6-6 6" {...stroke} />}
    </Svg>
  );
}
