import { UiIcon } from "@webstack/components/UiIcon/controller/UiIcon";

interface StreamProviderIconProps {
    provider: string;
    userHandle?: string | null;
    providerActive?: boolean;
    loading?: boolean;
    onClick?: (e: any) => void;
}

const providerUrl = (provider: string, userHandle?: string | null): string | null => {
    const handle = (userHandle || '').trim();
    if (!handle) return null;

    if (handle.startsWith('http://') || handle.startsWith('https://')) {
        return handle;
    }

    switch (provider) {
        case 'twitch':
            return `https://twitch.tv/${handle}`;
        case 'youtube':
            return handle.startsWith('@')
                ? `https://youtube.com/${handle}`
                : `https://youtube.com/@${handle}`;
        case 'facebook':
            return `https://facebook.com/${handle}`;
        default:
            return null;
    }
};

const StreamProviderIcon = ({
    provider,
    userHandle,
    providerActive,
    loading,
    onClick,
}: StreamProviderIconProps) => {
    const colors: Record<string, string> = {
        twitch: 'var(--purple-30)',
        youtube: 'var(--red-30)',
        facebook: 'var(--blue-30)',
        custom: 'var(--red-70)',
    };
    const icons: Record<string, string> = {
        twitch: 'fa-twitch',
        youtube: 'fa-youtube',
        facebook: 'fa-facebook',
        custom: 'fa-burger-cheese',
    };

    const href = providerUrl(provider, userHandle);
    const iconNode = (
        <UiIcon
            spin={loading}
            color={providerActive ? colors[provider] : undefined}
            icon={!loading ? icons[provider] : 'fa-spinner'}
        />
    );

    if (href && !loading) {
        return (
            <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                onClick={onClick}
                style={{ color: 'inherit' }}
            >
                {iconNode}
            </a>
        );
    }

    return (
        <span onClick={onClick} style={{ display: 'inline-flex' }}>
            {iconNode}
        </span>
    );
};

export default StreamProviderIcon;