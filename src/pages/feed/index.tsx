import dynamic from 'next/dynamic';

const CanopyFeed = dynamic(
    () => import('@Canopy/receiver/pages/CanopyFeed/controller/CanopyFeed'),
    { ssr: false },
);

export default function FeedPage() {
    return <CanopyFeed />;
}
