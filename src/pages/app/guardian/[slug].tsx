import { useEffect } from "react";
import { useRouter } from "next/router";

const GuardianSlugRedirect = () => {
  const router = useRouter();
  useEffect(() => {
    const slug = router.query?.slug;
    const suffix = Array.isArray(slug)
      ? `/${slug.join("/")}`
      : slug
      ? `/${slug}`
      : "";
    router.replace(`/app/guardian${suffix}`).catch(() => {});
  }, [router]);
  return null;
};

export default GuardianSlugRedirect;
