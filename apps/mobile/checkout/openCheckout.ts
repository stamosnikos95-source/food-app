import { Linking, Platform } from "react-native";

/** Hands the customer over to the payment provider's hosted checkout page. */
export async function openCheckout(url: string): Promise<void> {
  if (Platform.OS === "web") {
    window.location.assign(url);
    return;
  }
  await Linking.openURL(url);
}
