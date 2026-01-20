import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { Link } from "wouter";

interface HomeCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  testId: string;
}

export default function HomeCard({ title, description, icon: Icon, href, testId }: HomeCardProps) {
  return (
    <Card className="hover-elevate transition-all duration-200 hover:scale-105">
      <CardHeader className="space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href}>
          <Button className="w-full" size="lg" data-testid={testId}>
            Get Started
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}



