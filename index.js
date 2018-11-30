var app=require('express')();
var http=require('http').Server(app);
var io=require('socket.io')(http);
var db=require('./src/db');

//作为socket的键值对存储
var users={};

http.listen(3000,function(){
    console.log('listening on *:3000');
});

io.sockets.on('connection',function (socket) {
    console.log('a user connected');
    socket.on('disconnect',function () {
        console.log('user disconnected');
    });
    //监听到登录事件
    socket.on('login',function (data) {
        //查询数据库，验证账号密码
        db.query('select * from User where account='+data.account,function (res) {
            if(res.length === 1){
                if(res[0].password === data.password){
                    let itsname=res[0].username;
                    //成功登录，存储登录socket键值对
                    if(data.account in users){

                    }else{
                        users[data.account]= socket;
                    }

                    //成功登录，发送账号信息
                    socket.emit('sureLogin',{
                        flag:true,
                        userInfo:{
                            account:res[0].account,
                            username:res[0].username
                        }
                    });

                    //将登录上线信息推送给好友
                    let sqllan1='select * from friend where account in ';
                    sqllan1+='(select friendAccount from friend where account='+data.account+')';
                    sqllan1+=' and friendAccount='+data.account;
                    db.query(sqllan1,function (res2) {
                        for(let item of res2){
                            if(item.account in users){
                                users[item.account].emit('changeOnline',{
                                    flag:1,
                                    groupId:item.groupId,
                                    account:item.friendAccount
                                });
                            }
                        }
                    });

                    //修改账号状态
                    db.query('UPDATE user SET online=1 where account='+data.account,(res2) => {});

                    //获取并发送信息列表
                    //获取朋友列表
                    let sqllan2='select friend.friendAccount,friend.nonRead,user.username,memory.talker,memory.time,memory.msg,memory.memoryId';
                    sqllan2+=' from memory join friend on friend.memoryId=memory.memoryId and friend.account='+data.account;
                    sqllan2+=' join user on friend.friendAccount=user.account';
                    // sqllan2+=' where talker='+data.account;
                    sqllan2+=' order by memory.time desc';
                    db.query(sqllan2,function (res2) {
                        let msgList=[];
                        let friends={};
                        for(let item of res2){
                            if(item.memoryId in friends){
                            }else{
                                friends[item.memoryId]=item.username;
                                let thisMsg={};
                                thisMsg.id=item.friendAccount;
                                thisMsg.nonRead=item.nonRead;
                                thisMsg.name=item.username;
                                thisMsg.lastMsg={};
                                if(item.talker === data.account){
                                    thisMsg.lastMsg.talker=itsname;
                                }else{
                                    thisMsg.lastMsg.talker=item.username;
                                }
                                var nowTime=new Date().Format('dd/MM/yyyy');
                                if(nowTime ===item.time.Format('dd/MM/yyyy')){
                                    thisMsg.lastMsg.time=item.time.Format('hh:mm');
                                }else{
                                    thisMsg.lastMsg.time=item.time.Format('yyyy/MM/dd');
                                }
                                thisMsg.lastMsg.msg=item.msg;
                                msgList.push(thisMsg);
                            }
                        }
                        socket.emit('getMsgList',{
                            msgList:msgList
                        });
                    });

                    // db.query('select * from friend where account='+data.account,function (res2) {
                    //     let msgList=[];
                    //     let count=0;
                    //     if(res2.length>=1){
                    //         for(let item of res2){
                    //             let thisMsg={};
                    //             thisMsg.id=item.friendAccount;
                    //             thisMsg.nonRead=item.nonRead;
                    //             thisMsg.lastMsg={};
                    //             //获取朋友名
                    //             db.query('select username from user where account='+item.friendAccount,function (res3) {
                    //                 if(res3.length === 1){
                    //                     thisMsg.name=res3[0].username;
                    //                     //获取信息列表
                    //                     db.query('select * from memory where memoryId='+item.memoryId+' order by time DESC',function (res4) {
                    //                         if(res4.length>=1){
                    //                             db.query('select username from user where account='+res4[0].talker,function (res5) {
                    //                                 if(res5.length === 1){
                    //                                     thisMsg.lastMsg.talker=res5[0].username;
                    //
                    //                                     var nowTime=new Date().Format('dd/MM/yyyy');
                    //                                     if(nowTime === res4[0].time.Format('dd/MM/yyyy')){
                    //                                         thisMsg.lastMsg.time=res4[0].time.Format('hh:mm');
                    //                                     }else{
                    //                                         thisMsg.lastMsg.time=res4[0].time.Format('yyyy/MM/dd');
                    //                                     }
                    //                                     thisMsg.lastMsg.msg=res4[0].msg;
                    //                                     msgList.push(thisMsg);
                    //                                     count+=1;
                    //                                     if(count === res2.length){
                    //                                         socket.emit('getMsgList',{
                    //                                             msgList:msgList
                    //                                         });
                    //                                     }
                    //                                 }
                    //                             })
                    //                         }else{
                    //                             msgList.push(thisMsg);
                    //                             count+=1;
                    //                             if(count === res2.length){
                    //                                 socket.emit('getMsgList',{
                    //                                     msgList:msgList
                    //                                 });
                    //                             }
                    //                         }
                    //                     })
                    //                 }
                    //             });
                    //         }
                    //     }else{
                    //         socket.emit('getMsgList',{
                    //             msgList:msgList
                    //         });
                    //     }
                    // });

                    //获取并发送朋友群组表
                    let sqllan3='select friend.account,friend.groupId,friend.friendAccount,groups.groupName,groups.peopleNum,user.username,user.online';
                    sqllan3+=' from friend join groups on groups.groupId=friend.groupId';
                    sqllan3+=' join user on user.account=friend.friendAccount';
                    sqllan3+=' where friend.account='+data.account;
                    db.query(sqllan3,function (res2) {
                        let groupList=[];
                        let groups={};
                        for(let item of res2){
                            let thisGroup={};
                            if(item.groupId in groups){
                                for(let index of groupList){
                                    if(index.id === item.groupId){
                                        let thisFriend={};
                                        thisFriend.name=item.username;
                                        thisFriend.id=item.friendAccount;
                                        if(item.online === 1){
                                            groups[item.groupId]+=1;
                                        }
                                        index.peopleList.push(thisFriend);
                                    }
                                }
                            }else{
                                groups[item.groupId]=0;
                                thisGroup.id=item.groupId;
                                thisGroup.groupName=item.groupName
                                thisGroup.peopleNum=item.peopleNum;
                                thisGroup.peopleList=[];
                                let thisFriend={};
                                thisFriend.name=item.username;
                                thisFriend.id=item.friendAccount;
                                if(item.online === 1){
                                    groups[item.groupId]+=1;
                                }
                                thisGroup.peopleList.push(thisFriend);
                                groupList.push(thisGroup);
                            }
                        }
                        for(let item of groupList){
                            item.onlineNum=groups[item.id];
                        }
                        socket.emit('getGroupList',{
                            groupList:groupList
                        });
                    });

                    // db.query('select * from groups where account='+data.account,function (res2) {
                    //     let groupList=[];
                    //     let count=0;
                    //     if(res2.length >= 1){
                    //         for(let item of res2){
                    //             let thisGroup={};
                    //             let count2=0;
                    //             let onlineNum=0;
                    //             thisGroup.id=item.groupId;
                    //             thisGroup.groupName=item.groupName;
                    //             thisGroup.peopleNum=item.peopleNum;
                    //             thisGroup.peopleList=[];
                    //             db.query('select * from friend where account='+data.account+' and groupId='+item.groupId,function (res3) {
                    //                 if(res3.length >= 1){
                    //                     for(let item2 of res3){
                    //                         let thisFriend={};
                    //                         db.query('select username,online from user where account='+item2.friendAccount,function (res4) {
                    //                             if(res4.length === 1){
                    //                                 if(res4[0].online === 1){
                    //                                     onlineNum+=1;
                    //                                 }
                    //                                 thisFriend.name=res4[0].username;
                    //                                 thisFriend.id=res4[0].account;
                    //                                 thisGroup.peopleList.push(thisFriend);
                    //                                 count2+=1;
                    //                                 if(count2 === res3.length){
                    //                                     thisGroup.onlineNum=onlineNum;
                    //                                     groupList.push(thisGroup);
                    //                                     count+=1;
                    //                                 }
                    //
                    //                                 if(count === res2.length){
                    //                                     socket.emit('getGroupList',{
                    //                                         groupList:groupList
                    //                                     });
                    //                                 }
                    //                             }
                    //                         })
                    //                     }
                    //                 }else{
                    //                     thisGroup.onlineNum=onlineNum;
                    //                     groupList.push(thisGroup);
                    //                     count+=1;
                    //                     if(count === res2.length){
                    //                         socket.emit('getGroupList',{
                    //                             groupList:groupList
                    //                         });
                    //                     }
                    //                 }
                    //             })
                    //         }
                    //     }else{
                    //         socket.emit('getGroupList',{
                    //             groupList:groupList
                    //         });
                    //     }
                    // });

                    //监听事件，发送历史消息
                    socket.on('getMemory',function (data2) {
                        let sqllan='select * from memory join user on memory.talker=user.account where memoryId in ';
                        sqllan+='(select memoryId from friend where account='+data.account+' and friendAccount='+data2.friendAccount+')';
                        sqllan+=' order by time desc limit 5';
                        db.query(sqllan,function (res2) {
                            if(res2.length >= 1){
                                let wordList=[];
                                for(let i=res2.length-1;i>=0;i--){
                                    let thisWord={};
                                    let item=res2[i];
                                    thisWord.name=item.username;
                                    var nowTime=new Date().Format('dd/MM/yyyy');
                                    if(nowTime === item.time.Format('dd/MM/yyyy')){
                                        thisWord.time=item.time.Format('hh:mm');
                                    }else{
                                        thisWord.time=item.time.Format('MM-dd');
                                    }

                                    thisWord.msg=item.msg;
                                    wordList.push(thisWord);
                                    if(i === 0){
                                        socket.emit('sendMemory',{
                                            wordList:wordList
                                        });
                                    }
                                }
                            }
                        });
                    });

                    //接收消息并发送给对方
                    socket.on('sendMsg',function (data2) {
                        db.query('select memoryId from friend where account='+data.account+' and friendAccount='+data2.talker,function (res2) {
                            if(res2.length === 1){
                                db.query('insert into memory(memoryId,talker,msg) values('+res2[0].memoryId+',"'+data.account+'","'+data2.msg+'")',function () {
                                    socket.emit('gotMsg',{
                                        flag:true
                                    });
                                    if(data2.talker in users){
                                        users[data2.talker].emit('reciveMsg',{
                                            flag:true
                                        })
                                    }
                                })
                            }
                        })
                    });

                    //关闭连接的时候改变账号状态
                    socket.on('disconnect',function () {
                        //将账号状态修改推送给各个好友
                        let sqllan='select * from friend where account in ';
                        sqllan+='(select friendAccount from friend where account='+data.account+')';
                        sqllan+=' and friendAccount='+data.account;
                        db.query(sqllan,function (res2) {
                            for(let item of res2){
                                if(item.account in users){
                                    users[item.account].emit('changeOnline',{
                                        flag:0,
                                        groupId:item.groupId,
                                        account:item.friendAccount
                                    });
                                }
                            }
                        });

                        db.query('UPDATE user SET online=0 where account='+data.account,(res2) => {});
                        delete users[data.account];
                    });

                }else{
                    socket.emit('sureLogin',{
                        flag:false,
                        msg:'密码错误！'
                    });
                }
            }else{
                socket.emit('sureLogin',{
                    flag:false,
                    msg:'不存在此用户！'
                });
            }
        })
    });
})

//时间格式转换
Date.prototype.Format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1, //Month
        "d+": this.getDate(), //Day
        "h+": this.getHours(), //Hour
        "m+": this.getMinutes(), //Minute
        "s+": this.getSeconds(), //Second
        "q+": Math.floor((this.getMonth() + 3) / 3), //Season
        "S": this.getMilliseconds() //millesecond
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
};
