import React, { useState, useEffect, useRef } from 'react';
import './ActionMenu.css';

/**
 * ActionMenu - Component with action icons at the bottom of GamePage
 * Displays a menu of options when an action icon is clicked
 */
const ActionMenu = ({ onOpenSideview, onSetActiveTab }) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef(null);

  // Check if screen is mobile on mount and when window resizes
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1200);
    };
    
    // Initial check
    checkMobile();
    
    // Listen for window resize
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Define the action menu options
  const menuOptions = {
    trade: ['import', 'export'],
    hybrid: ['sabotage', 'interference', 'disinformation'],
    attack: ['missiles', 'maritime', 'ground', 'aerial']
  };

  // Handle icon click to toggle menu
  const handleIconClick = (menuType) => {
    // Special case for map icon - open sideview with country tab
    if (menuType === 'map') {
      // Close any open menu
      setActiveMenu(null);
      // Then open sideview with country tab
      onOpenSideview();
      onSetActiveTab('country');
      return;
    }
    
    // If clicking the active menu, close it
    if (activeMenu === menuType) {
      setActiveMenu(null);
    } else {
      // Otherwise, open the clicked menu
      setActiveMenu(menuType);
    }
  };

  // Handle option click
  const handleOptionClick = (option) => {
    console.log(`Selected option: ${option}`);
    // Here you would handle the specific action for each option
    // For now, we'll just close the menu after selection
    setActiveMenu(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get label for each option
  const getOptionLabel = (option) => {
    const labels = {
      // Trade options
      'import': 'Importação',
      'export': 'Exportação',
      
      // Hybrid war options
      'sabotage': 'Sabotagem',
      'interference': 'Ingerência',
      'disinformation': 'Desinformação',
      
      // Military attack options
      'missiles': 'Mísseis',
      'maritime': 'Marítimo',
      'ground': 'Terrestre',
      'aerial': 'Aéreo'
    };
    
    return labels[option] || option;
  };

  // Get icon for each action type
  const getActionIcon = (action) => {
    const icons = {
      'trade': 'directions_boat ',
      'hybrid': 'public_off',
      'attack': 'gps_fixed',
      'map': 'map' 
    };
    
    return icons[action] || 'help';
  };

  // Get title for each action type
  const getActionTitle = (action) => {
    const titles = {
      'trade': 'Acordo Comercial',
      'hybrid': 'Guerra Híbrida',
      'attack': 'Ataque Bélico',
      'map': 'Ver País Selecionado' // Added map title
    };
    
    return titles[action] || '';
  };

  return (
    <div className="action-menu-container" ref={menuRef}>
      {/* Options menu - positioned above the icons */}
      {activeMenu && (
        <div className="action-options">
          {menuOptions[activeMenu].map((option, index) => (
            <button 
              key={index} 
              className="action-option"
              onClick={() => handleOptionClick(option)}
            >
              {getOptionLabel(option)}
            </button>
          ))}
        </div>
      )}

      {/* Action icons */}
      <div className="action-icons">
        <button 
          className={`action-icon ${activeMenu === 'trade' ? 'active' : ''}`}
          onClick={() => handleIconClick('trade')}
          title={getActionTitle('trade')}
        >
          <span className="material-icons">{getActionIcon('trade')}</span>
        </button>
        
        <button 
          className={`action-icon ${activeMenu === 'hybrid' ? 'active' : ''}`}
          onClick={() => handleIconClick('hybrid')}
          title={getActionTitle('hybrid')}
        >
          <span className="material-icons">{getActionIcon('hybrid')}</span>
        </button>
        
        <button 
          className={`action-icon ${activeMenu === 'attack' ? 'active' : ''}`}
          onClick={() => handleIconClick('attack')}
          title={getActionTitle('attack')}
        >
          <span className="material-icons">{getActionIcon('attack')}</span>
        </button>
        
        {/* Map icon to open sideview with country information - only on mobile */}
        {isMobile && (
          <button 
            className="action-icon"
            onClick={() => handleIconClick('map')}
            title={getActionTitle('map')}
          >
            <span className="material-icons">{getActionIcon('map')}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionMenu;