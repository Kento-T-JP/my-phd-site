declare module "react-google-recaptcha" {
  import * as React from "react";

  export interface ReCAPTCHAProps {
    sitekey: string;
    onChange?: (token: string | null) => void;
  }

  const ReCAPTCHA: React.ComponentType<ReCAPTCHAProps>;
  export default ReCAPTCHA;
}
