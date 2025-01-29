import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function Profile() {
  return (
    <Link href="/profile">
      <Avatar className="fixed top-4 right-4">
        <AvatarImage src=""/>
        <AvatarFallback>OSL</AvatarFallback>
      </Avatar>
    </Link>
  );
};


