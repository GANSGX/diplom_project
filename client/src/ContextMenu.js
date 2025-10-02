import React from 'react';
import './ContextMenu.css';

const ContextMenu = ({ x, y, onClose, items }) => {
  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div 
        className="context-menu" 
        style={{ left: `${x}px`, top: `${y}px` }}
        onClick={onClose}
      >
        {items.map((item, index) => (
          item.divider ? (
            <div key={index} className="context-menu-divider" />
          ) : (
            <button
              key={index}
              className={`context-menu-item ${item.danger ? 'context-menu-item-danger' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                onClose();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          )
        ))}
      </div>
    </>
  );
};

export default ContextMenu;