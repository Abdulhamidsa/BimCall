import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, Building2, User, Loader2 } from "lucide-react";

interface SearchUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  companyId: string | null;
  companyName: string | null;
  isActive: boolean;
}

interface UserDirectorySearchProps {
  onSelectUser: (user: SearchUser) => void;
  placeholder?: string;
  excludeUserIds?: string[];
  showInlineResults?: boolean;
}

export function UserDirectorySearch({
  onSelectUser,
  placeholder = "Search users by name or email...",
  excludeUserIds = [],
  showInlineResults = false,
}: UserDirectorySearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults = [], isLoading } = useQuery<SearchUser[]>({
    queryKey: ["/api/users/search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`);
      if (!res.ok) throw new Error("Failed to search users");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const filteredResults = searchResults.filter(
    (user) => !excludeUserIds.includes(user.id)
  );

  const handleSelectUser = useCallback((user: SearchUser) => {
    onSelectUser(user);
    setSearchQuery("");
    setIsOpen(false);
  }, [onSelectUser]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const ResultsList = () => (
    <div className="space-y-1">
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          {searchQuery.length < 2 
            ? "Type at least 2 characters to search" 
            : "No users found"}
        </div>
      ) : (
        filteredResults.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
            onClick={() => handleSelectUser(user)}
            data-testid={`user-result-${user.id}`}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar ?? undefined} />
              <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{user.name}</span>
                {!user.isActive && (
                  <Badge variant="secondary" className="text-xs">Inactive</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              {user.companyName && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{user.companyName}</span>
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" className="shrink-0">
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}
    </div>
  );

  if (showInlineResults) {
    return (
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="user-directory-search-input"
          />
        </div>
        {searchQuery.length >= 2 && (
          <Card>
            <CardContent className="p-2">
              <ScrollArea className="max-h-[300px]">
                <ResultsList />
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length >= 2) {
                setIsOpen(true);
              }
            }}
            onFocus={() => {
              if (searchQuery.length >= 2) {
                setIsOpen(true);
              }
            }}
            className="pl-9"
            data-testid="user-directory-search-input"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-2" align="start">
        <ScrollArea className="max-h-[300px]">
          <ResultsList />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function CompanyDetectionBadge({ email }: { email: string }) {
  const [detectedCompany, setDetectedCompany] = useState<{
    company: { id: string; name: string; logo: string | null } | null;
    emailDomain: string;
    isPublicDomain: boolean;
  } | null>(null);

  useEffect(() => {
    if (!email || !email.includes("@")) {
      setDetectedCompany(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/detect-by-email?email=${encodeURIComponent(email)}`);
        if (res.ok) {
          setDetectedCompany(await res.json());
        }
      } catch (error) {
        console.error("Failed to detect company:", error);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email]);

  if (!detectedCompany) return null;

  if (detectedCompany.isPublicDomain) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
        <User className="h-3 w-3" />
        <span>Personal email address</span>
      </div>
    );
  }

  if (detectedCompany.company) {
    return (
      <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
        <Building2 className="h-3 w-3" />
        <span>Will be assigned to: <strong>{detectedCompany.company.name}</strong></span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
      <Building2 className="h-3 w-3" />
      <span>Domain: {detectedCompany.emailDomain} (no matching company)</span>
    </div>
  );
}
