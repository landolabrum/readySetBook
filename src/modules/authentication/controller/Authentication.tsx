import { useEffect, useState } from "react";
import styles from "./Authentication.scss";
import { useRouter } from "next/router";
import Link from "next/link";
import { useModal } from "@webstack/components/Containers/modal/contexts/modalContext";
import { useNotification } from "@webstack/components/Notification/Notification";
import WelcomeBack from "../views/WelcomeBack/WelcomeBack";
import UiButton from "@webstack/components/UiForm/components/UiButton/UiButton";
import type {
  AuthMode,
  AuthProviderRegistry,
  AuthProviderId,
} from "./AuthTypes";
import { normalizeProviders, resolveProvider } from "./AuthProviders";

type AuthTextProps = {
  view?: 'sign-in' | 'sign-up';
  title?: string;
  description?: string;
  buttonText?: string;
  alternateText?: string;
  toggleText?: string;
};

type AuthenticationProps = {
  view?: string;
  variant?: string;
  // Optional auth context, e.g. merchant-login
  mode?: AuthMode;
  // Optional provider configuration (defaults to email/password)
  providers?: AuthProviderRegistry | import("./AuthTypes").AuthProvider[];
  providerId?: AuthProviderId;
  content?: {
    [key: string]: AuthTextProps;
  };
};

const Authentication: React.FC<AuthenticationProps> = ({
  view = "sign-in",
  content,
  mode = "default",
  variant,
  providers,
  providerId,
}) => {
  const [newCustomerEmail, setNewCustomerEmail] = useState<string | undefined>();
  const [hover, setHover] = useState<boolean>(false);
  const [viewState, setView] = useState<string>(view); // Ensure this is initialized properly
  // Ensure this is initialized properly
  const router = useRouter();
  const { query } = router;
  const { openModal, closeModal } = useModal();
  const [notif, setNotification] = useNotification();

  // Resolve the active provider (email/password by default)
  const providerRegistry = normalizeProviders(providers);
  const provider = resolveProvider(providerRegistry, providerId);

  const ProviderLoginView = provider?.components.Login;
  const ProviderSignUp = provider?.components.SignUp;

  const handleViewToggle = () => {
    setView((prev: string) => (prev === "sign-in" ? "sign-up" : "sign-in"));
  };

  const handleSignup = (response: any) => {
    const status = response?.status;
    let label = "404, an error occurred signing up.";
    if (status === "created") label = `email: ${response?.email}, successfully created.`;
    if (status === "existing") label = `email: ${response?.email}, exists.`;

    setNotification({
      active: true,
      list: [{ label, message: "Please wait a few minutes before logging in" }],
    });
    setView("sign-in");
    setNewCustomerEmail(response.email);
  };

  const handleSignIn = (user: any) => {
    if (user?.id) {
      openModal({
        title: "User Details",
        variant: "popup",
        children: <WelcomeBack user={user} onClose={closeModal} />,
      });
    }
  };

  useEffect(() => {
    if (query?.verify && viewState !== "verify") setView("verify");
    if (newCustomerEmail) setView("sign-in");
  }, [newCustomerEmail, router.query]);

  const defaultText: { [key: string]: AuthTextProps } = {
    "sign-in": {

      title: "sign in",
      // alternateText: "no account?",
      toggleText: "Don't have a login? Click here to Sign Up",
    },
    "sign-up": {
      title: "sign up",
      // alternateText: "already have an account?",
      toggleText: "click here to Login",
    },
  };

  const contentProps = {
    ...defaultText[viewState],
    ...content?.[viewState],
  };

  return (
    <>
      <style jsx>{styles}</style>

      {JSON.stringify(query?.mode)
      }
      <div className={`authentication ${variant ||''} ${viewState === "sign-in" ? "authentication__sign-in" : ""}`}>
        <div className="authentication__view-header">
          {/* <div className="authentication__logo">
          </div> */}
          <div className="authentication__view-name">{contentProps.title}</div>
          <div>

            <UiButton
              variant="link"
              onClick={handleViewToggle} >
              {contentProps.alternateText}
              {contentProps.toggleText}
            </UiButton>
          </div>
        </div>

        {viewState.includes("@") && (
          <div className="authentication__email-verify">
            An email has been sent to
            <Link
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              style={hover ? { color: "var(--primary)" } : undefined}
              href={`mailto://${viewState}`}
            >
              {" " + viewState + ", "}
            </Link>
            click the link in the email to continue.
          </div>
        )}

        {viewState === "sign-in" && ProviderLoginView && (
          <ProviderLoginView email={newCustomerEmail} onSuccess={handleSignIn} />
        )}
        {viewState === "sign-up" && ProviderSignUp && (
          <ProviderSignUp onSuccess={handleSignup} />
        )}

      </div>
    </>
  );
};

export default Authentication;
