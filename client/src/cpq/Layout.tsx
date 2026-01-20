import Header from "./components/Header";
import React from "react";

export default function CPQLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Header />
            <main className="flex-1">{children}</main>
        </div>
    );
}

