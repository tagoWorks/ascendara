import React from 'react';

const ErrorCard = ({ message }) => {
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
      <strong className="font-bold">Uh oh... </strong>
      <span className="block sm:inline">{message}</span>
    </div>
  );
};

export default ErrorCard;
