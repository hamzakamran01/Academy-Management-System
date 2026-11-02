import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <EmptyState icon={SearchX} title="Page not found" description="The page you're looking for doesn't exist or was moved." action={<ButtonLink href="/home">Go home</ButtonLink>} />
    </div>
  );
}
