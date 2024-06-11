import React, { useState } from "react";
import { Input } from "@nextui-org/react";

export default function SearchBox({ onSearch }) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value, false);
  };

  const handleClear = () => {
    setSearchQuery("");
    onSearch("", false)
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      // Handle search functionality here
    }
  };

  return (
    <Input
      size="lg"
      type="text"
      placeholder="Search..."
      variant="underlined"
      value={searchQuery}
      onChange={handleSearch}
      onKeyDown={handleKeyDown}
      onClear={handleClear}
    />
  );
}