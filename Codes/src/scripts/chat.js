let allMessages = [];

document.addEventListener("DOMContentLoaded", async () => {
    const { checkUserLoggedIn } = await import('./utils.js');
    checkUserLoggedIn(); // Check if the user is logged in

    const currentChat = localStorage.getItem("currentChat");
    getAllMessages().then(() => {
        if (currentChat) {
            loadChat(currentChat);
        }
    });
});

function getAllMessages() {
    const from = localStorage.getItem("loginId");
    const APIKEY = "678a13b229bb6d4dd6c56bd2";
    const MESSAGES_URL = "https://mokesell-2304.restdb.io/rest/messages";

    // Fetch all messages where the user is the `from` or the `to`
    const query = {
        "$or": [
            { "from._id": from },
            { "to._id": from }
        ]
    };

    return fetch(`${MESSAGES_URL}?q=${encodeURIComponent(JSON.stringify(query))}&h={"$orderby": {"_created": 1}}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "x-apikey": APIKEY,
        },
    })
    .then((response) => response.json())
    .then((messages) => {
        allMessages = messages;
        loadContacts();
    })
    .catch((error) => {
        console.error("Error fetching messages:", error);
    });
}

function loadContacts() {
    const from = localStorage.getItem("loginId");
    const contactList = document.querySelector('.contact-list');
    contactList.innerHTML = '';

    const contacts = allMessages.reduce((acc, message) => {
        const contactId = message.from[0]._id === from ? message.to[0]._id : message.from[0]._id;
        if (!acc[contactId] || new Date(message._created) > new Date(acc[contactId]._created)) {
            acc[contactId] = message;
        }
        return acc;
    }, {});

    Object.values(contacts).reverse().forEach((contact) => {
        const contactData = contact.from[0]._id === from ? contact.to[0] : contact.from[0];
        const lastMessage = contact.message;
        const contactItem = document.createElement('div');
        contactItem.classList.add('contact-item');
        contactItem.setAttribute('onclick', `switchChat('${contactData._id}')`);
        contactItem.innerHTML = `
            <img src="/src/images/avatar-placeholder.jpg" alt="Avatar" class="avatar" />
            <div class="contact-info">
                <span class="contact-name">${contactData.username}</span>
                <span class="contact-status">${lastMessage}</span>
            </div>
        `;
        contactList.appendChild(contactItem);
    });
}

function switchChat(contact) {
    // Remove active class from all contacts
    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    
    // Add active class to the selected contact
    document.querySelector(`.contact-item[onclick="switchChat('${contact}')"]`).classList.add('active');
    
    // Set current chat in localStorage
    localStorage.setItem("currentChat", contact);
    
    // Load the selected chat
    loadChat(contact);
}

function loadChat(contact) {
    const chatContainer = document.getElementById('chat-container');
    const chatAvatar = document.getElementById('chat-avatar');
    const chatContactName = document.getElementById('chat-contact-name');
    const chatHeader = document.getElementById('chat-header');
    const chatInputContainer = document.getElementById('chat-input-container');
    const APIKEY = "678a13b229bb6d4dd6c56bd2";
    const ACCOUNTS_URL = "https://mokesell-2304.restdb.io/rest/accounts";
    const LISTINGS_URL = "https://mokesell-2304.restdb.io/rest/listings";
    const OFFERS_URL = "https://mokesell-2304.restdb.io/rest/offers";
    const COUPONS_URL = "https://mokesell-2304.restdb.io/rest/coupons";
    const from = localStorage.getItem("loginId");
    const to = contact;
    
    // Clear existing chat messages
    chatContainer.innerHTML = '';
    chatContainer.classList.remove('chat-container-empty');
    
    // Show chat header and input container
    chatHeader.style.display = 'flex';
    chatInputContainer.style.display = 'flex';
    
    // Fetch recipient's username
    fetch(`${ACCOUNTS_URL}/${contact}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "x-apikey": APIKEY,
        },
    })
    .then((response) => response.json())
    .then((data) => {
        chatContactName.textContent = data.username;
        
        // Filter messages between logged in user and current chat
        const messages = allMessages.filter(message => 
            (message.from[0]._id === from && message.to[0]._id === to) ||
            (message.from[0]._id === to && message.to[0]._id === from)
        );

        messages.forEach((message) => {
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('chat-message', message.from[0]._id === from ? 'sent' : 'received');
            
            if (message.offer) {
                const offerCard = document.createElement('div');
                offerCard.classList.add('offer-card', message.from[0]._id === from ? 'sent' : 'received');
                chatContainer.appendChild(offerCard);

                fetch(`${LISTINGS_URL}/${message.offer[0].listing[0]}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "x-apikey": APIKEY,
                    },
                })
                .then((response) => response.json())
                .then((listing) => {
                    let offerDetailsHTML = `
                        <img src="/src/images/${listing.image}" alt="${listing.title}" class="offer-image" />
                        <div class="offer-details">
                            <h4>${listing.title}</h4>
                            <p>Offer Price: S$${message.offer[0].price}</p>
                    `;

                    if (message.offer[0].coupon && message.from[0]._id === from) {
                        fetch(`${COUPONS_URL}/${message.offer[0].coupon[0]}`, {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                                "x-apikey": APIKEY,
                            },
                        })
                        .then((response) => response.json())
                        .then((coupon) => {
                            const deductedPrice = message.offer[0].price - coupon.amount;
                            offerDetailsHTML += `
                                <p>Original Offer Price: <s>S$${message.offer[0].price}</s></p>
                                <p>Discounted Price: S$${deductedPrice}</p>
                            `;
                            offerCard.innerHTML = offerDetailsHTML + '</div>';
                        })
                        .catch((error) => {
                            console.error("Error fetching coupon:", error);
                        });
                    } else {
                        offerCard.innerHTML = offerDetailsHTML + '</div>';
                    }

                    const offerStatus = document.createElement('div');
                    offerStatus.classList.add('offer-status');
                    offerCard.appendChild(offerStatus);

                    if (from === listing.sellerID[0]._id) {
                        if (message.offer[0].accept) {
                            offerStatus.innerHTML = `<span class="bi bi-check-circle"> Payment Received</span>`;
                        } else {
                            const acceptButton = document.createElement('button');
                            acceptButton.classList.add('btn', 'btn-success');
                            acceptButton.textContent = 'Accept Offer';
                            acceptButton.addEventListener('click', () => {
                                fetch(`${OFFERS_URL}/${message.offer[0]._id}`, {
                                    method: "PATCH",
                                    headers: {
                                        "Content-Type": "application/json",
                                        "x-apikey": APIKEY,
                                    },
                                    body: JSON.stringify({ accept: true })
                                })
                                .then(() => {
                                    offerStatus.innerHTML = `<span class="bi bi-check-circle"> Payment Received</span>`;
                                    showOfferAcceptedAnimation();
                                    // Decrease the quantity of the listing
                                    fetch(`${LISTINGS_URL}/${listing._id}`, {
                                        method: "PATCH",
                                        headers: {
                                            "Content-Type": "application/json",
                                            "x-apikey": APIKEY,
                                        },
                                        body: JSON.stringify({ quantity: listing.quantity - 1 })
                                    })
                                    .catch((error) => {
                                        console.error("Error updating listing quantity:", error);
                                    });

                                    // Mark the coupon as used
                                    if (message.offer[0].coupon) {
                                        fetch(`${COUPONS_URL}/${message.offer[0].coupon[0]}`, {
                                            method: "PATCH",
                                            headers: {
                                                "Content-Type": "application/json",
                                                "x-apikey": APIKEY,
                                            },
                                            body: JSON.stringify({ used: true })
                                        })
                                        .catch((error) => {
                                            console.error("Error marking coupon as used:", error);
                                        });
                                    }
                                })
                                .catch((error) => {
                                    console.error("Error accepting offer:", error);
                                });
                            });
                            offerStatus.appendChild(acceptButton);
                        }
                    } else {
                        if (message.offer[0].accept) {
                            offerStatus.innerHTML = `<span class="bi bi-check-circle"> Item Shipped</span>`;
                            const ratingContainer = document.createElement('div');
                            ratingContainer.classList.add('rating-container');
                            ratingContainer.innerHTML = `
                                <span>Rate: </span>
                                <span class="bi bi-star" data-rating="1"></span>
                                <span class="bi bi-star" data-rating="2"></span>
                                <span class="bi bi-star" data-rating="3"></span>
                                <span class="bi bi-star" data-rating="4"></span>
                                <span class="bi bi-star" data-rating="5"></span>
                            `;
                            offerStatus.appendChild(ratingContainer);

                            ratingContainer.querySelectorAll('.bi-star').forEach(star => {
                                star.addEventListener('click', () => {
                                    const rating = star.getAttribute('data-rating');
                                    fetch(`${OFFERS_URL}/${message.offer[0]._id}`, {
                                        method: "PATCH",
                                        headers: {
                                            "Content-Type": "application/json",
                                            "x-apikey": APIKEY,
                                        },
                                        body: JSON.stringify({ rating: rating })
                                    })
                                    .then(() => {
                                        alert("Rating submitted!");
                                    })
                                    .catch((error) => {
                                        console.error("Error submitting rating:", error);
                                    });
                                });
                            });
                        } else {
                            offerStatus.innerHTML = `<span class="bi bi-clock"> Awaiting Confirmation</span>`;
                        }
                    }
                })
                .catch((error) => {
                    console.error("Error fetching listing:", error);
                });
            }

            messageBubble.innerHTML = `
                <p>${message.message}</p>
                <span class="timestamp">${new Date(message.sent).toLocaleTimeString()}</span>
            `;
            chatContainer.appendChild(messageBubble);
        });
        chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to the bottom
    })
    .catch((error) => {
        console.error("Error fetching recipient's username:", error);
    });
}

document.querySelector('.chat-send-button').addEventListener('click', sendMessage);

function sendMessage() {
    const messageInput = document.querySelector('.chat-input');
    const message = messageInput.value.trim();
    const from = localStorage.getItem("loginId");
    const to = localStorage.getItem("currentChat");
    const APIKEY = "678a13b229bb6d4dd6c56bd2";
    const MESSAGES_URL = "https://mokesell-2304.restdb.io/rest/messages";

    if (message === '') return;

    // Send message to the API
    fetch(MESSAGES_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-apikey": APIKEY,
        },
        body: JSON.stringify({
            from: from,
            to: to,
            message: message,
            sent: new Date().toISOString()
        })
    })
    .then((response) => response.json())
    .then((data) => {
        // Append the sent message to the chat container
        const chatContainer = document.getElementById('chat-container');
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('chat-message', 'sent');
        messageBubble.innerHTML = `
            <p>${message}</p>
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
        `;
        chatContainer.appendChild(messageBubble);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to the bottom
        messageInput.value = ''; // Clear the input field

        getAllMessages().then(() => {
            loadChat(to);
        });
    })
    .catch((error) => {
        console.error("Error sending message:", error);
    });
}

function showOfferAcceptedAnimation() {
    const overlay = document.createElement('div');
    overlay.className = 'animation-overlay';
    overlay.innerHTML = `
        <dotlottie-player src="https://lottie.host/9f216acb-8548-4bc1-8363-400b0100e82e/V3cM8D5RRj.lottie" background="transparent" speed="1" style="width: 300px; height: 300px" loop autoplay></dotlottie-player>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
        document.body.removeChild(overlay);
    }, 3000); // Remove after 3 seconds
}


document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".header");
    const headerHeight = header.offsetHeight;
    document.body.style.paddingTop = `${headerHeight}px`;
  });