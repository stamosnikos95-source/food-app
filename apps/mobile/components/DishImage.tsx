import { useState } from "react";
import { Image, ImageStyle, StyleProp, StyleSheet, View } from "react-native";
import { Icon } from "./Icon";
import { theme } from "../theme";

/** A dish photo, or a calm placeholder when there is none (or it fails to load). */
export function DishImage({ uri, style }: { uri: string | null | undefined; style: StyleProp<ImageStyle> }) {
  const [failed, setFailed] = useState(false);
  const usable = typeof uri === "string" && uri.startsWith("http") && !failed;
  if (!usable) {
    return (
      <View style={[style as object, styles.placeholder]}>
        <Icon name="bowl" size={30} color={theme.color.accent} />
      </View>
    );
  }
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: theme.color.accentSoft, alignItems: "center", justifyContent: "center" },
});
