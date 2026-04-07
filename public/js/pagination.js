/**
 * Pagination Component
 * A reusable class to handle in-memory pagination for arrays of items.
 */
class Pagination {
  /**
   * @param {Object} options
   * @param {string} options.containerId - The ID of the pagination container
   * @param {number} options.itemsPerPage - Number of items to show per page
   * @param {Function} options.onPageChange - Callback function when page changes (receives paginated items and fresh favorite IDs)
   * @param {string} [options.scrollToId] - Optional element ID to scroll to on page change
   */
  constructor(options) {
    this.container = document.getElementById(options.containerId);
    this.itemsPerPage = options.itemsPerPage || 12;
    this.onPageChange = options.onPageChange;
    this.scrollToId = options.scrollToId;
    
    this.allItems = [];
    this.currentPage = 1;

    if (this.container) {
      this.container.addEventListener("click", (e) => {
        const btn = e.target.closest(".pagination__btn");
        if (!btn || btn.disabled) return;

        const page = parseInt(btn.dataset.page);
        if (!isNaN(page)) {
          this.goToPage(page);
        }
      });
    }
  }

  /**
   * Initialize or update the data to be paginated
   * @param {Array} items - The full list of items
   * @param {number} [startPage=1] - Optional start page
   */
  setItems(items, startPage = 1) {
    this.allItems = items || [];
    this.goToPage(startPage);
  }

  async goToPage(page) {
    this.currentPage = page;
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const paginatedItems = this.allItems.slice(start, end);

    // Provide items and total info to the callback
    if (this.onPageChange) {
      await this.onPageChange({
        items: paginatedItems,
        currentPage: this.currentPage,
        pageSize: this.itemsPerPage,
        totalItems: this.allItems.length,
        startRange: start + 1,
        endRange: Math.min(end, this.allItems.length)
      });
    }

    this.render();
    
    if (page > 1 && this.scrollToId) {
      this.scrollToTop();
    }
  }

  render() {
    if (!this.container) return;
    
    const totalPages = Math.ceil(this.allItems.length / this.itemsPerPage);
    if (totalPages <= 1) {
      this.container.innerHTML = "";
      return;
    }

    let html = "";
    
    // Prev Button
    html += `
      <button class="pagination__btn" ${this.currentPage === 1 ? "disabled" : ""} data-page="${this.currentPage - 1}" title="Página Anterior">
        <i class="fa-solid fa-chevron-left"></i>
      </button>
    `;

    // Logic for visible pages
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      html += `<button class="pagination__btn" data-page="1">1</button>`;
      if (startPage > 2) html += `<span class="pagination__info">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === this.currentPage ? "pagination__btn--active" : "";
      html += `<button class="pagination__btn ${activeClass}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span class="pagination__info">...</span>`;
      html += `<button class="pagination__btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next Button
    html += `
      <button class="pagination__btn" ${this.currentPage === totalPages ? "disabled" : ""} data-page="${this.currentPage + 1}" title="Próxima Página">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;

    this.container.innerHTML = html;
  }

  scrollToTop() {
    const target = document.getElementById(this.scrollToId);
    if (!target) return;
    
    const navHeight = document.getElementById("navbar")?.offsetHeight || 80;
    const targetY = target.offsetTop - navHeight - 20;
    
    window.scrollTo({
      top: targetY,
      behavior: "smooth"
    });
  }
}

window.Pagination = Pagination;
