import React, { useState } from "react";
import { Input, Select, SelectItem } from "@nextui-org/react";

export default function SearchBox({ onSearch }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlineOnly] = useState(false);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    onSearch(e.target.value, showOnlineOnly);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      // Handle search functionality here
    }
  };

  return (
        <Input
          type="text"
          label="Search..."
          value={searchQuery}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
        />
  );
}