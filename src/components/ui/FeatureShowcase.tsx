'use client';

import React, { useState } from 'react';

export function TailwindV4Showcase() {
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr');
  
  return (
    <div className="p-6 space-y-8" dir={direction}>
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold text-shadow">Tailwind CSS v4 Features</h1>
        <button 
          onClick={() => setDirection(dir => dir === 'ltr' ? 'rtl' : 'ltr')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Toggle {direction === 'ltr' ? 'RTL' : 'LTR'}
        </button>
      </div>
      
      {/* Container Queries */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Container Queries</h2>
        <p className="text-muted-foreground">Resize the containers below to see the content adapt:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="@container border rounded-lg p-4 resize-x overflow-auto min-w-[200px] max-w-[600px] h-[200px]">
            <p className="@[200px]:text-sm @[300px]:text-base @[400px]:text-lg @[500px]:text-xl">
              This text changes size based on container width
            </p>
            <div className="@[300px]:flex @[300px]:flex-row @[300px]:items-center mt-4 space-y-2 @[300px]:space-y-0 @[300px]:space-x-2">
              <div className="bg-primary-100 p-2 rounded">Item 1</div>
              <div className="bg-primary-100 p-2 rounded">Item 2</div>
              <div className="bg-primary-100 p-2 rounded">Item 3</div>
            </div>
          </div>
          
          <div className="@container border rounded-lg p-4">
            <div className="grid @[400px]:grid-cols-2 @[600px]:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-gray-100 p-4 rounded">Item {i}</div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* Logical Properties */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Logical Properties</h2>
        <p className="text-muted-foreground">Toggle direction to see how these adapt to RTL:</p>
        
        <div className="border rounded-lg p-4">
          <div className="flex items-center border-s-4 border-primary ps-4 mb-4">
            <p>Border and padding on the start side</p>
          </div>
          
          <div className="flex justify-between">
            <div className="bg-gray-100 p-2 rounded me-4">Start aligned</div>
            <div className="bg-gray-100 p-2 rounded ms-4">End aligned</div>
          </div>
        </div>
      </section>
      
      {/* Text Shadow */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Text Shadow</h2>
        
        <div className="border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <h3 className="text-lg font-bold text-shadow">Regular Shadow</h3>
          <h3 className="text-lg font-bold text-shadow-md text-primary">Medium Shadow</h3>
          <h3 className="text-lg font-bold text-shadow-lg text-primary-600">Large Shadow</h3>
        </div>
      </section>
      
      {/* Element Masking */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Element Masking</h2>
        
        <div className="border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="mask mask-square bg-gradient-to-r from-primary-500 to-primary-700 w-20 h-20"></div>
          <div className="mask mask-circle bg-gradient-to-r from-primary-500 to-primary-700 w-20 h-20"></div>
          <div className="mask mask-triangle bg-gradient-to-r from-primary-500 to-primary-700 w-20 h-20"></div>
          <div className="mask mask-hexagon bg-gradient-to-r from-primary-500 to-primary-700 w-20 h-20"></div>
        </div>
      </section>
      
      {/* Colored Drop Shadows */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Colored Drop Shadows</h2>
        
        <div className="border rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-lg shadow-primary-500/30">
            Primary Shadow
          </div>
          <div className="bg-white p-4 rounded-lg shadow-lg shadow-red-500/30">
            Red Shadow
          </div>
          <div className="bg-white p-4 rounded-lg shadow-lg shadow-blue-500/30">
            Blue Shadow
          </div>
        </div>
      </section>
    </div>
  );
} 