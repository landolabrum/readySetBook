import { useEffect } from "react";
import { useRouter } from "next/router";

const YtlRedirect = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/ytl").catch(() => {});
  }, [router]);
  return null;
};

export default YtlRedirect;
