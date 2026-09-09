import {
    AuthProvider,
    AuthProviderRegistry,
    AuthProviderId,
} from "./AuthTypes";
import LoginView from "../views/Login/views/LoginView/LoginView";
import ResetPassword from "../views/Login/views/ResetPassword/ResetPassword";
import SignUp from "../views/SignUp/SignUp";
import TwoFactorInput from "../views/Login/views/TwoFactorAuth/TwoFactorAuth";

// Default email/password provider backed by MemberService
export const emailPasswordAuthProvider: AuthProvider = {
    id: "email-password",
    label: "Email",
    description: "Sign in with email and password",
    supports: {
        login: true,
        signUp: true,
        resetPassword: true,
        // Two-factor UI exists but is not yet wired into backend flow
        twoFactor: false,
    },
    components: {
        Login: LoginView,
        SignUp: SignUp,
        ResetPassword: ResetPassword,
        TwoFactor: TwoFactorInput,
    },
};

export const defaultAuthProviders: AuthProviderRegistry = {
    [emailPasswordAuthProvider.id]: emailPasswordAuthProvider,
};

export type AuthProviderInput = AuthProviderRegistry | AuthProvider[] | undefined;

export function normalizeProviders(
    providers?: AuthProviderRegistry | AuthProvider[],
): AuthProviderRegistry {
    if (!providers) {
        return defaultAuthProviders;
    }

    if (Array.isArray(providers)) {
        return providers.reduce((acc, provider) => {
            acc[provider.id] = provider;
            return acc;
        }, {} as AuthProviderRegistry);
    }

    return providers;
}

export function resolveProvider(
    providers: AuthProviderRegistry,
    preferredId?: AuthProviderId,
): AuthProvider | undefined {
    if (preferredId && providers[preferredId]) {
        return providers[preferredId];
    }

    const firstKey = Object.keys(providers)[0] as AuthProviderId | undefined;
    return firstKey ? providers[firstKey] : undefined;
}
