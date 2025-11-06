'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatBlockNumber } from '@/lib/utils/format';
import { ChevronLeft, ChevronRight, Home, RefreshCw } from 'lucide-react';

interface BlockSelectorProps {
  currentBlock: number;
  latestBlock: number;
  onBlockChange: (blockNumber: number) => void;
  loading?: boolean;
  onRefresh?: () => void;
}

export function BlockSelector({
  currentBlock,
  latestBlock,
  onBlockChange,
  loading = false,
  onRefresh,
}: BlockSelectorProps) {
  const [inputValue, setInputValue] = useState(currentBlock.toString());

  const handlePrevious = () => {
    if (currentBlock > 1) {
      onBlockChange(currentBlock - 1);
      setInputValue((currentBlock - 1).toString());
    }
  };

  const handleNext = () => {
    if (currentBlock < latestBlock) {
      onBlockChange(currentBlock + 1);
      setInputValue((currentBlock + 1).toString());
    }
  };

  const handleGoToLatest = () => {
    onBlockChange(latestBlock);
    setInputValue(latestBlock.toString());
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const blockNum = parseInt(inputValue, 10);
    if (!isNaN(blockNum) && blockNum >= 1 && blockNum <= latestBlock) {
      onBlockChange(blockNum);
    } else {
      setInputValue(currentBlock.toString());
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-white border rounded-lg">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          disabled={currentBlock <= 1 || loading}
          aria-label="Previous block"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <form onSubmit={handleInputSubmit} className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Block</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputSubmit}
            className="w-24 px-2 py-1 text-center border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={loading}
          />
          <span className="text-sm text-muted-foreground">of {formatBlockNumber(latestBlock)}</span>
        </form>

        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={currentBlock >= latestBlock || loading}
          aria-label="Next block"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoToLatest}
          disabled={currentBlock === latestBlock || loading}
        >
          <Home className="h-4 w-4 mr-1" />
          Latest
        </Button>

        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      {currentBlock < latestBlock && (
        <div className="text-xs text-muted-foreground">
          {latestBlock - currentBlock} blocks behind
        </div>
      )}
    </div>
  );
}