import type React from "react";

export type AuthProviderId = "email-password" | string;

// High-level auth flow context (can be extended later)
export type AuthMode = "default" | "merchant-login";

export interface AuthLoginProps {
    onSuccess?: (user: any) => void;
    email?: string;
    title?: string | React.ReactElement;

}

export interface AuthResetPasswordProps {
    email?: string;
}

export interface AuthSignUpProps {
    onSuccess?: (result: any) => void;
    title?: string | React.ReactElement;
}

export interface AuthTwoFactorProps {
    code: string;
    setCode: (value: string) => void;
}

export interface AuthProvider {
    id: AuthProviderId;
    label: string;
    description?: string;
    // Optional hint for how this provider is used (e.g., merchant-specific flows)
    modeHint?: AuthMode;
    supports: {
        login?: boolean;
        signUp?: boolean;
        resetPassword?: boolean;
        twoFactor?: boolean;
    };
    components: {
        Login?: React.ComponentType<AuthLoginProps>;
        SignUp?: React.ComponentType<AuthSignUpProps>;
        ResetPassword?: React.ComponentType<AuthResetPasswordProps>;
        TwoFactor?: React.ComponentType<AuthTwoFactorProps>;
    };
}

export type AuthProviderRegistry = Record<AuthProviderId, AuthProvider>;

// Shared login props used by Login controller and views
export interface ILogin extends AuthLoginProps {
    view?: "login" | "reset-password";
    providerId?: AuthProviderId;
    providers?: AuthProviderRegistry | AuthProvider[];
}
