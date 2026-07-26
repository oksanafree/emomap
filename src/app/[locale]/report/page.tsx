"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

export default function ReportPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/history?showReport=1");
  }, [router]);

  return null;
}
