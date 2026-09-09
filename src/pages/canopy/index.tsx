import { useEffect } from "react";
import { useRouter } from "next/router";

const CanopyRedirect = () => {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/canopy").catch(() => {});
  }, [router]);
  return null;
};

export default CanopyRedirect;
